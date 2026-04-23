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
} from '../shared/constants'

/**
 * Centralized API client for all LinkCode backend communication.
 * Uses Smoothlink (OpenAI-compatible) Chat Completions API.
 */
export class ApiClient {
  private readonly getApiKey: () => Promise<string | undefined>

  constructor(getApiKey: () => Promise<string | undefined>) {
    this.getApiKey = getApiKey
  }

  /**
   * Fetch a single-shot code completion using Chat Completions API.
   * Smoothlink has no dedicated FIM endpoint, so we simulate with chat.
   */
  async complete(
    payload: CompletionRequest,
    signal?: AbortSignal
  ): Promise<string | null> {
    const logger = Logger.getInstance()
    const headers = await this.getHeaders()
    const endpoint = this.getEndpoint()
    const model = this.getCompletionModel()

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
   * Uses OpenAI-compatible Chat Completions endpoint.
   */
  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<ChatStreamChunk> {
    const headers = await this.getHeaders()
    const endpoint = this.getEndpoint()
    const model = this.getModel()

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
        const logger = Logger.getInstance()
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

  private async getHeaders(): Promise<Record<string, string>> {
    const apiKey = await this.getApiKey()
    if (!apiKey) {
      throw new AuthError('API Key 未配置')
    }
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
