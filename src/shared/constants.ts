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
