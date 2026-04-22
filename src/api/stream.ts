import type { ChatStreamChunk } from './types'

/**
 * Parse an SSE (Server-Sent Events) stream and yield chunks.
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) {
        break
      }

      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) {
          // Comment or empty line — skip
          continue
        }

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)

          if (data === '[DONE]') {
            yield { type: 'done' }
            return
          }

          try {
            const parsed = JSON.parse(data) as { content?: string; error?: string }
            if (parsed.error) {
              yield { type: 'error', error: parsed.error }
              return
            }
            if (parsed.content) {
              yield { type: 'token', content: parsed.content }
            }
          } catch {
            // Non-JSON data line — skip
          }
        }
      }
    }

    yield { type: 'done' }
  } finally {
    reader.releaseLock()
  }
}
