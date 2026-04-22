/**
 * Shared types for LinkCode API communication
 */

export interface CompletionRequest {
  prefix: string
  suffix?: string
  language: string
  filepath?: string
}

export interface CompletionResponse {
  completion: string
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  stream?: boolean
  model?: string
}

export interface ChatStreamChunk {
  type: 'token' | 'done' | 'error'
  content?: string
  error?: string
}

export interface ApiError {
  error: string
  status: number
}
