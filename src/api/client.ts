import * as vscode from 'vscode'
import type {
  CompletionRequest,
  ChatMessage,
  ChatStreamChunk,
} from './types'
import { parseSSEStream } from './stream'
import { Logger } from '../utils/logger'
import { AuthError, ApiError } from '../shared/errors'
import {
  API_TIMEOUT_MS,
  CONFIG_SECTION,
  DEFAULT_MODEL,
  DEFAULT_COMPLETION_MODEL,
  DEFAULT_API_ENDPOINT,
  MODEL_TO_GROUP,
} from '../shared/constants'
import type { SecretStore } from '../utils/secretStorage'

/**
 * Centralized API client for all LinkCode backend communication.
 * Uses Smoothlink (OpenAI-compatible) Chat Completions API.
 */
export class ApiClient {
  private readonly getApiKey: () => Promise<string | undefined>
  private secretStore?: SecretStore

  constructor(getApiKey: () => Promise<string | undefined>, secretStore?: SecretStore) {
    this.getApiKey = getApiKey
    this.secretStore = secretStore
  }

  /** Set the SecretStore for group token routing */
  public setSecretStore(store: SecretStore): void {
    this.secretStore = store
  }

  /** Expose API key for external use (e.g. fetching model list) */
  public async resolveApiKey(): Promise<string | undefined> {
    return this.getApiKey()
  }

  /**
   * Resolve the API key for a specific model, using group token routing.
   * Returns { apiKey, group } or throws AuthError.
   */
  public async resolveApiKeyForModel(model: string): Promise<{ apiKey: string; group: string | undefined }> {
    const group = MODEL_TO_GROUP[model]

    // Try group-specific token from SecretStorage first
    if (group && this.secretStore) {
      const groupToken = await this.secretStore.getGroupToken(group)
      if (groupToken) {
        return { apiKey: groupToken, group }
      }
    }

    // Fallback to general API key
    const apiKey = await this.getApiKey()
    if (apiKey) {
      return { apiKey, group }
    }

    throw new AuthError(
      group
        ? `分组 ${group} 的 API Token 未配置，且无通用 API Key`
        : 'API Key 未配置',
      group
    )
  }

  /**
   * Fetch a single-shot code completion using Chat Completions API.
   */
  async complete(
    payload: CompletionRequest,
    signal?: AbortSignal
  ): Promise<string | null> {
    const logger = Logger.getInstance()
    const model = this.getCompletionModel()
    const headers = await this.getHeaders(model)
    const endpoint = this.getEndpoint()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是专业代码补全助手。根据代码上下文，只输出补全内容，不加任何解释或 Markdown 格式。',
      },
      {
        role: 'user',
        content: [
          `语言: ${payload.language}`,
          payload.filepath ? `文件: ${payload.filepath}` : '',
          `\n<prefix>${payload.prefix}</prefix>`,
          payload.suffix ? `<suffix>${payload.suffix}</suffix>` : '',
          '\n直接输出补全代码：',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ]

    try {
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          temperature: 0.1,
          max_tokens: 256,
          stop: ['\n\n\n'],
        }),
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'unknown')
        logger.error(
          `API request failed: ${res.status} ${res.statusText} — ${errorBody}`
        )
        return null
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>
      }
      return data.choices?.[0]?.message?.content?.trim() ?? null
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Stream a chat response from the Smoothlink API (SSE).
   */
  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<ChatStreamChunk> {
    const model = this.getModel()
    const headers = await this.getHeaders(model)
    const endpoint = this.getEndpoint()

    const logger = Logger.getInstance()
    logger.info(`[streamChat] model=${model} endpoint=${endpoint}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
    }

    try {
      const res = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: 0.2,
          max_tokens: 4096,
        }),
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'unknown')
        logger.error(
          `Chat API request failed: ${res.status} ${res.statusText} — ${errorBody}`
        )
        throw new ApiError(
          `API error: ${res.status} ${res.statusText}`,
          res.status
        )
      }

      yield* parseSSEStream(res, controller.signal)
    } finally {
      clearTimeout(timeout)
    }
  }

  private async getHeaders(model?: string): Promise<Record<string, string>> {
    const targetModel = model ?? this.getModel()
    const { apiKey } = await this.resolveApiKeyForModel(targetModel)
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }
  }

  private getEndpoint(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<string>('apiEndpoint') ?? DEFAULT_API_ENDPOINT
  }

  private getModel(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<string>('model') ?? DEFAULT_MODEL
  }

  private getCompletionModel(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<string>('completionModel') ?? DEFAULT_COMPLETION_MODEL
  }
}
