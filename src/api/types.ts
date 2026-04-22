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

/** Messages sent from the extension to the WebView */
export type ExtensionToWebview =
  | { type: 'streamToken'; payload: string }
  | { type: 'streamDone' }
  | { type: 'streamError'; error: string }
  | { type: 'userAction'; action: string; payload: string }

/** Messages sent from the WebView to the extension */
export type WebviewToExtension =
  | { type: 'sendMessage'; payload: string }
  | { type: 'ready' }
