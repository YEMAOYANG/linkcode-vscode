import * as vscode from 'vscode'
import type { CompletionRequest, CompletionResponse, ChatMessage, ChatStreamChunk } from './types'
import { parseSSEStream } from './stream'
import { Logger } from '../utils/logger'
import { AuthError, ApiError } from '../shared/errors'
import { API_TIMEOUT_MS, CONFIG_SECTION } from '../shared/constants'

/**
 * Centralized API client for all LinkCode backend communication.
 * Encapsulates authentication, timeouts, error handling, and streaming.
 */
export class ApiClient {
  private readonly getApiKey: () => Promise<string | undefined>

  constructor(getApiKey: () => Promise<string | undefined>) {
    this.getApiKey = getApiKey
  }

  /**
   * Fetch a single-shot code completion from the API.
   */
  async complete(
    payload: CompletionRequest,
    signal?: AbortSignal
  ): Promise<string | null> {
    const logger = Logger.getInstance()
    const headers = await this.getHeaders()
    const endpoint = this.getEndpoint()

    const controller = new AbortController()
    const effectiveSignal = signal ?? controller.signal

    // Timeout control
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const res = await fetch(`${endpoint}/v1/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: effectiveSignal,
      })

      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'unknown')
        logger.error(
          `API request failed: ${res.status} ${res.statusText} — ${errorBody}`
        )
        return null
      }

      const data = (await res.json()) as CompletionResponse
      return data.completion ?? null
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
   * Stream a chat response from the API (SSE).
   * Yields individual tokens as they arrive.
   */
  async *streamChat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<ChatStreamChunk> {
    const headers = await this.getHeaders()
    const endpoint = this.getEndpoint()

    const controller = new AbortController()
    const effectiveSignal = signal ?? controller.signal

    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const res = await fetch(`${endpoint}/v1/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages, stream: true }),
        signal: effectiveSignal,
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

      yield* parseSSEStream(res, effectiveSignal)
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
    return config.get<string>('apiEndpoint') ?? 'https://api.linkcode.ai'
  }
}

// ─── Legacy function exports (for backward compat during migration) ────────

function getConfig() {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
  return {
    apiEndpoint:
      config.get<string>('apiEndpoint') ?? 'https://api.linkcode.ai',
  }
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

/**
 * Fetch a single-shot code completion from the API.
 * @deprecated Use `ApiClient.complete()` instead.
 */
export async function fetchCompletion(
  payload: CompletionRequest,
  getApiKey: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<string | null> {
  const { apiEndpoint } = getConfig()
  const apiKey = await getApiKey()
  const logger = Logger.getInstance()

  try {
    const res = await fetch(`${apiEndpoint}/v1/complete`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'unknown')
      logger.error(
        `API request failed: ${res.status} ${res.statusText} — ${errorBody}`
      )
      return null
    }

    const data = (await res.json()) as CompletionResponse
    return data.completion ?? null
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return null
    }
    throw err
  }
}

/**
 * Stream a chat response from the API (SSE).
 * @deprecated Use `ApiClient.streamChat()` instead.
 */
export async function streamChat(
  messages: ChatMessage[],
  getApiKey: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<Response> {
  const { apiEndpoint } = getConfig()
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new AuthError(
      'API key is not set. Please run "LinkCode: Set API Key" command.'
    )
  }

  const res = await fetch(`${apiEndpoint}/v1/chat`, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ messages, stream: true }),
    signal,
  })

  if (!res.ok) {
    const logger = Logger.getInstance()
    const errorBody = await res.text().catch(() => 'unknown')
    logger.error(
      `Chat API request failed: ${res.status} ${res.statusText} — ${errorBody}`
    )
    throw new ApiError(`API error: ${res.status} ${res.statusText}`, res.status)
  }

  return res
}
