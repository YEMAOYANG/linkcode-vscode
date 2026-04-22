/**
 * Completion module — cache utilities for inline completion.
 *
 * Note: InlineCompletionProvider lives in providers/ (VS Code provider layer)
 * and is registered directly in extension.ts. This module exports only the
 * cache and related completion-domain utilities.
 */
export { CompletionCache } from './cache'
