import * as vscode from 'vscode'
import type { ApiClient } from '../api/client'
import { extractContext } from '../utils/context'
import { CompletionCache } from '../completion/cache'
import { CONFIG_SECTION, DEBOUNCE_MS } from '../shared/constants'

export class InlineCompletionProvider
  implements vscode.InlineCompletionItemProvider, vscode.Disposable
{
  private abortController: AbortController | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | undefined
  private readonly cache = new CompletionCache()
  private readonly apiClient: ApiClient

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient
  }

  dispose(): void {
    this.abortController?.abort()
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer)
    }
    this.cache.clear()
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    // Abort previous in-flight request
    this.abortController?.abort()
    this.abortController = new AbortController()

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    if (!config.get<boolean>('enableInlineCompletion')) {
      return null
    }

    // Check LRU cache before debouncing
    const linePrefix = document
      .lineAt(position.line)
      .text.substring(0, position.character)
    const cacheKey = CompletionCache.buildKey(
      document.uri.toString(),
      linePrefix
    )
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return new vscode.InlineCompletionList([
        new vscode.InlineCompletionItem(
          cached,
          new vscode.Range(position, position)
        ),
      ])
    }

    // Debounce: wait before making the request
    const debounceMs = config.get<number>('completionDebounceMs') ?? DEBOUNCE_MS
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer)
    }

    await new Promise<void>((resolve) => {
      this.debounceTimer = setTimeout(resolve, debounceMs)
    })

    // Check if cancelled during debounce
    if (token.isCancellationRequested || this.abortController.signal.aborted) {
      return null
    }

    // Extract context using shared utility
    const ctx = extractContext(document, position)

    // Wire cancellation token to abort controller
    const cancelDisposable = token.onCancellationRequested(() => this.abortController?.abort())

    try {
      const completion = await this.apiClient.complete(
        {
          prefix: ctx.prefix,
          suffix: ctx.suffix,
          language: ctx.language,
          filepath: ctx.filepath,
        },
        this.abortController.signal
      )

      if (!completion) {
        return null
      }

      // Store in cache
      this.cache.set(cacheKey, completion)

      return new vscode.InlineCompletionList([
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position)
        ),
      ])
    } catch {
      return null
    } finally {
      cancelDisposable.dispose()
    }
  }
}
