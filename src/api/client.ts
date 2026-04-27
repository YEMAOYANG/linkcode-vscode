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
  GROUP_FAST_COMPLETION_MODEL,
  FAST_COMPLETION_GROUP_PRIORITY,
} from '../shared/constants'
import type { SecretStore } from '../utils/secretStorage'

export interface CompletionDegradationStatus {
  requested: string
  actual: string
  degraded: boolean
  reason?: string
}

export type CompletionStatusListener = (status: CompletionDegradationStatus) => void

/**
 * Centralized API client for all LinkCode backend communication.
 * Uses Smoothlink (OpenAI-compatible) Chat Completions API.
 */
export class ApiClient {
  private readonly getApiKey: () => Promise<string | undefined>
  private secretStore?: SecretStore
  private statusListener?: CompletionStatusListener
  private lastCompletionStatus?: CompletionDegradationStatus

  constructor(getApiKey: () => Promise<string | undefined>, secretStore?: SecretStore) {
    this.getApiKey = getApiKey
    this.secretStore = secretStore
  }

  /** Set the SecretStore for group token routing */
  public setSecretStore(store: SecretStore): void {
    this.secretStore = store
  }

  /** Phase 5D: subscribe to completion-model degradation updates */
  public onCompletionStatus(listener: CompletionStatusListener): void {
    this.statusListener = listener
    if (this.lastCompletionStatus) {
      listener(this.lastCompletionStatus)
    }
  }

  public getCompletionStatus(): CompletionDegradationStatus | undefined {
    return this.lastCompletionStatus
  }

  private emitStatus(status: CompletionDegradationStatus): void {
    this.lastCompletionStatus = status
    this.statusListener?.(status)
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
    const requested = this.getCompletionModel()

    // Phase 5D: auto-degrade when the requested model has no resolvable key
    const resolved = await this.resolveCompletionModel(requested)
    if (!resolved) {
      this.emitStatus({
        requested,
        actual: requested,
        degraded: false,
        reason: 'no token configured for any supported group',
      })
      logger.warn(`[complete] no key available for any fallback model (requested=${requested})`)
      return null
    }

    this.emitStatus({
      requested,
      actual: resolved.model,
      degraded: resolved.model !== requested,
      reason: resolved.reason,
    })

    const model = resolved.model
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resolved.apiKey}`,
    }
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

    // Phase 5E: multi-line, cross-file, diagnostic-aware prompt (Cursor-style next-edit prediction)
    const systemPrompt =
      '你是专业的代码补全引擎。根据光标上下文预测用户"下一步"要写的代码片段——可能是多行补全、补齐函数/类、也可能是插入缺失的 import 语句。只输出要插入到光标位置的代码，不要 Markdown 代码围栏，不要解释文字。保留原始缩进。'

    const userParts: string[] = [
      `Language: ${payload.language}`,
      payload.filepath ? `File: ${payload.filepath}` : '',
    ]

    if (payload.openTabs && payload.openTabs.length > 0) {
      userParts.push(`\nOpen editor tabs (user is multitasking on these):\n- ${payload.openTabs.join('\n- ')}`)
    }

    if (payload.neighbourFiles && payload.neighbourFiles.length > 0) {
      userParts.push('\nRecently edited files (context only, do not echo back):')
      for (const n of payload.neighbourFiles) {
        userParts.push(`\n--- ${n.path} ---\n${n.snippet}`)
      }
    }

    if (payload.diagnostics && payload.diagnostics.length > 0) {
      userParts.push(`\nLinter diagnostics in current file:\n- ${payload.diagnostics.join('\n- ')}`)
    }

    userParts.push(`\n<prefix>${payload.prefix}</prefix>`)
    if (payload.suffix) userParts.push(`<suffix>${payload.suffix}</suffix>`)
    userParts.push('\n直接输出补全代码（可多行，若需要补 import 请一并给出）：')

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userParts.filter(Boolean).join('\n') },
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
          temperature: 0.2,
          max_tokens: 512,
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

  /**
   * Phase 5D: try the requested completion model; if its group has no token,
   * degrade to the fastest model of the first available group.
   */
  private async resolveCompletionModel(
    requested: string,
  ): Promise<{ model: string; apiKey: string; reason?: string } | undefined> {
    try {
      const { apiKey } = await this.resolveApiKeyForModel(requested)
      return { model: requested, apiKey }
    } catch {
      // fall through to degradation
    }

    if (!this.secretStore) {
      // No group-specific routing possible; try legacy key directly
      const legacy = await this.getApiKey()
      if (legacy) {
        return {
          model: requested,
          apiKey: legacy,
          reason: '未启用分组 token 路由，使用通用 key',
        }
      }
      return undefined
    }

    const configured = await this.secretStore.getConfiguredGroups()
    if (configured.length === 0) return undefined

    for (const group of FAST_COMPLETION_GROUP_PRIORITY) {
      if (!configured.includes(group)) continue
      const fallbackModel = GROUP_FAST_COMPLETION_MODEL[group]
      if (!fallbackModel) continue
      const token = await this.secretStore.getGroupToken(group)
      if (!token) continue
      return {
        model: fallbackModel,
        apiKey: token,
        reason: `降级到 ${group} 分组的 ${fallbackModel}`,
      }
    }
    return undefined
  }
}
