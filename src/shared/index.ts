/**
 * Shared module — cross-module types, constants, and errors.
 */
export type { ExtToWebMsg, WebToExtMsg, CodeContext } from './types'
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
} from './constants'
