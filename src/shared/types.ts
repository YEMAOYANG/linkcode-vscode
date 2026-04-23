/**
 * Shared type definitions for Extension ↔ WebView communication.
 * All message types use discriminated unions for type safety.
 */

/**
 * Code context attached to chat messages for AI reference.
 */
export interface CodeContext {
  code: string
  language: string
  filename: string
}

/**
 * Stored chat message shape (shared between extension host and webview).
 */
export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/**
 * Messages sent from the Extension Host to the WebView.
 */
export type ExtToWebMsg =
  | { type: 'stream_start' }
  | { type: 'stream_chunk'; content: string }
  | { type: 'stream_end' }
  | { type: 'stream_error'; message: string }
  | { type: 'inline_edit'; code: string; language: string }
  | { type: 'code_review'; code: string }
  | { type: 'user_action'; action: 'explain' | 'refactor' | 'review'; payload: string }
  | { type: 'loadHistory'; messages: StoredChatMessage[] }

/**
 * Messages sent from the WebView to the Extension Host.
 */
export type WebToExtMsg =
  | { type: 'sendMessage'; text: string; context?: CodeContext }
  | { type: 'getApiKey' }
  | { type: 'applyEdit'; code: string }
  | { type: 'ready' }
  | { type: 'getHistory' }
  | { type: 'saveMessages'; messages: StoredChatMessage[] }
