import * as vscode from 'vscode'
import type { CompletionRequest, CompletionResponse } from './types'

function getConfig() {
  const config = vscode.workspace.getConfiguration('linkcode')
  return {
    apiEndpoint:
      config.get<string>('apiEndpoint') ?? 'https://api.linkcode.ai',
    apiKey: config.get<string>('apiKey') ?? '',
  }
}

function getHeaders(): Record<string, string> {
  const { apiKey } = getConfig()
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
  signal: AbortSignal
): Promise<string | null> {
  const { apiEndpoint } = getConfig()

  try {
    const res = await fetch(`${apiEndpoint}/v1/complete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
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
