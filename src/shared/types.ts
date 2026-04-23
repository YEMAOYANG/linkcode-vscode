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
 * Pricing item from smoothlink.ai/api/pricing.
 */
export interface PricingItem {
  model_name: string
  model_ratio: number
  enable_groups: string[]
  tags?: string
  description?: string
  quota_type?: number // 1 = free model
}

/**
 * Full pricing API response shape.
 */
export interface PricingResponse {
  data: PricingItem[]
  group_ratio?: Record<string, number>
}

/**
 * Messages sent from the Extension Host to the WebView.
 */
/**
 * Model info returned from the /v1/models API.
 */
export interface ApiModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

export type ExtToWebMsg =
  | { type: 'stream_start' }
  | { type: 'stream_chunk'; content: string }
  | { type: 'stream_end'; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
  | { type: 'stream_error'; message: string }
  | { type: 'inline_edit'; code: string; language: string }
  | { type: 'code_review'; code: string }
  | { type: 'user_action'; action: 'explain' | 'refactor' | 'review'; payload: string }
  | { type: 'loadHistory'; messages: StoredChatMessage[] }
  | { type: 'modelInfo'; modelId: string }
  | { type: 'modelList'; models: ApiModelInfo[] }
  | { type: 'chatCleared' }
  | { type: 'show_onboarding' }
  | { type: 'apiKeyValidated'; success: boolean; message?: string }
  | { type: 'show_error'; errorType: string; message?: string }
  | { type: 'clear_error' }
  | { type: 'show_code_review' }
  | { type: 'show_inline_edit' }
  | { type: 'show_login' }
  | { type: 'recentFiles'; files: Array<{ name: string; path: string }> }
  | { type: 'code_review_start'; fileName?: string }
  | { type: 'code_review_chunk'; content: string }
  | { type: 'code_review_end' }
  | { type: 'inline_edit_context'; code: string; fileName?: string }
  | { type: 'inline_edit_start' }
  | { type: 'inline_edit_chunk'; content: string }
  | { type: 'inline_edit_end' }
  | { type: 'tokenMissing'; group: string; model: string }
  | { type: 'tokenInvalid'; group: string }
  | { type: 'groupTokenValidated'; group: string; success: boolean; message?: string; models?: string[] }
  | { type: 'groupTokenStatus'; tokens: Record<string, boolean> }
  | { type: 'open_settings'; tab?: string; highlightGroup?: string }
  | { type: 'fileContent'; filepath: string; content: string; name: string }
  | { type: 'historyList'; sessions: SessionSummary[] }
  | { type: 'pricingData'; models: PricingItem[]; groupRatio: Record<string, number> }

/**
 * Session summary for history list.
 */
export interface SessionSummary {
  id: string
  title: string
  messageCount: number
  timestamp: number
  model?: string
}

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
  | { type: 'changeModel'; modelId: string }
  | { type: 'newChat' }
  | { type: 'setApiKey'; key: string }
  | { type: 'validateApiKey'; key: string }
  | { type: 'updateConfig'; key: string; value: unknown }
  | { type: 'onboardingComplete' }
  | { type: 'feedback'; messageId?: string; rating: string; category: string }
  | { type: 'getRecentFiles' }
  | { type: 'attachFile'; name: string; content: string }
  | { type: 'startCodeReview' }
  | { type: 'inlineEditRequest'; instruction: string; code: string }
  | { type: 'inlineEditAccept'; code: string }
  | { type: 'githubLogin' }
  | { type: 'setGroupToken'; group: string; token: string }
  | { type: 'deleteGroupToken'; group: string }
  | { type: 'validateGroupToken'; group: string; token: string }
  | { type: 'getGroupTokenStatus' }
  | { type: 'openSettings'; tab?: string; highlightGroup?: string }
  | { type: 'openExternal'; url: string }
  | { type: 'getFileContent'; filepath: string }
  | { type: 'getSessionHistory' }
  | { type: 'loadSession'; sessionId: string }
