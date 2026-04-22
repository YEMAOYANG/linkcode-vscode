import * as vscode from 'vscode'
import type { CompletionRequest, CompletionResponse, ChatMessage } from './types'
import { Logger } from '../utils/logger'

function getConfig() {
  const config = vscode.workspace.getConfiguration('linkcode')
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
      logger.error(`API request failed: ${res.status} ${res.statusText} — ${errorBody}`)
      return null
    }

    const data = (await res.json()) as CompletionResponse
    return data.completion ?? null
  } catch (err: unknown) {
    // AbortError is expected when user keeps typing
    if (err instanceof Error && err.name === 'AbortError') {
      return null
    }
    throw err
  }
}

/**
 * Stream a chat response from the API (SSE).
 */
export async function streamChat(
  messages: ChatMessage[],
  getApiKey: () => Promise<string | undefined>,
  signal: AbortSignal
): Promise<Response> {
  const { apiEndpoint } = getConfig()
  const apiKey = await getApiKey()

  if (!apiKey) {
    throw new Error('API key is not set. Please run "LinkCode: Set API Key" command.')
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
    logger.error(`Chat API request failed: ${res.status} ${res.statusText} — ${errorBody}`)
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res
}
