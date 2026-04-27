/**
 * Shared module — cross-module types, constants, and errors.
 */
export type { ExtToWebMsg, WebToExtMsg, CodeContext, StoredChatMessage, SessionSummary, ChatMode } from './types'
export { SYSTEM_PROMPTS, BUILD_FROM_PLAN_TEMPLATE } from './prompts'
export { LinkCodeError, ApiError, AuthError } from './errors'
export {
  DEBOUNCE_MS,
  CACHE_TTL_MS,
  MAX_CACHE_SIZE,
  API_TIMEOUT_MS,
  MAX_CONTEXT_LINES_BEFORE,
  MAX_CONTEXT_LINES_AFTER,
  SECRET_KEY_API,
  CONFIG_SECTION,
  DEFAULT_API_ENDPOINT,
  DEFAULT_MODEL,
  DEFAULT_COMPLETION_MODEL,
  MODEL_TO_GROUP,
  GROUP_TO_MODELS,
  RECOMMENDED_GROUP_ORDER,
  TOKEN_GROUPS,
  inferTokenGroup,
} from './constants'
export type { TokenGroupDef } from './constants'
