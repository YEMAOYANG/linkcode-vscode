/**
 * Global constants for the LinkCode extension.
 * Centralizes magic numbers and configuration defaults.
 */

/** Debounce delay for inline completion requests (ms) */
export const DEBOUNCE_MS = 300

/** LRU cache time-to-live for completion entries (ms) */
export const CACHE_TTL_MS = 30_000

/** Maximum number of entries in the completion LRU cache */
export const MAX_CACHE_SIZE = 50

/** Default API request timeout (ms) */
export const API_TIMEOUT_MS = 30_000

/** Maximum lines of context before cursor */
export const MAX_CONTEXT_LINES_BEFORE = 100

/** Maximum lines of context after cursor */
export const MAX_CONTEXT_LINES_AFTER = 50

/** SecretStorage key for the API key */
export const SECRET_KEY_API = 'linkcode.apiKey'

/** Extension configuration section name */
export const CONFIG_SECTION = 'linkcode'

/** Default Smoothlink API endpoint */
export const DEFAULT_API_ENDPOINT = 'https://smoothlink.ai'

/** Default chat model */
export const DEFAULT_MODEL = 'claude-sonnet-4-6'

/** Default inline completion model (fast & cheap) */
export const DEFAULT_COMPLETION_MODEL = 'claude-haiku-4-5-20251001'

/** Recommended models list for UI display */
export const RECOMMENDED_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', tag: '推荐' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic', tag: '最强推理' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'Anthropic', tag: '最快' },
  { id: 'deepseek-r1', label: 'DeepSeek R1', provider: 'DeepSeek', tag: '强推理' },
  { id: 'deepseek-v3', label: 'DeepSeek V3', provider: 'DeepSeek', tag: '性价比' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', tag: '长上下文' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', tag: '快速' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'OpenAI', tag: '' },
] as const
