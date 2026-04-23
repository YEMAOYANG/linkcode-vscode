import type { ChatStreamChunk } from './types'

/**
 * Shape of a single SSE chunk from OpenAI-compatible Chat Completions API.
 */
interface OpenAIStreamChunk {
  id?: string
  object?: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Parse an SSE (Server-Sent Events) stream from an OpenAI-compatible API
 * and yield ChatStreamChunk events.
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
  let lastUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined

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
            const chunk = JSON.parse(data) as OpenAIStreamChunk

            // Check for error in response
            if ('error' in chunk) {
              const errObj = chunk as unknown as { error: { message?: string } }
              yield { type: 'error', error: errObj.error?.message ?? 'Unknown API error' }
              return
            }

            const delta = chunk.choices?.[0]?.delta
            const finishReason = chunk.choices?.[0]?.finish_reason

            if (delta?.content) {
              yield { type: 'token', content: delta.content }
            }

            // Capture usage from the chunk (often present in the last chunk)
            if (chunk.usage) {
              lastUsage = chunk.usage
            }

            if (finishReason === 'stop' || finishReason === 'length') {
              yield { type: 'done', usage: lastUsage }
              return
            }
          } catch {
            // Non-JSON data line — skip
          }
        }
      }
    }

    yield { type: 'done', usage: lastUsage }
  } finally {
    reader.releaseLock()
  }
}
