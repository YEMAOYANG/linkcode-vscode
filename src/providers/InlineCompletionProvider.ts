import * as vscode from 'vscode'
import { fetchCompletion } from '../api/client'
import { extractContext } from '../utils/context'

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private abortController: AbortController | null = null
  private getApiKey: () => Promise<string | undefined>
  private debounceTimer: ReturnType<typeof setTimeout> | undefined

  constructor(getApiKey: () => Promise<string | undefined>) {
    this.getApiKey = getApiKey
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

    const config = vscode.workspace.getConfiguration('linkcode')
    if (!config.get<boolean>('enableInlineCompletion')) {
      return null
    }

    const debounceMs = config.get<number>('completionDebounceMs') ?? 300

    // Debounce: wait before making the request
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
    token.onCancellationRequested(() => this.abortController?.abort())

    try {
      const completion = await fetchCompletion(
        {
          prefix: ctx.prefix,
          suffix: ctx.suffix,
          language: ctx.language,
          filepath: ctx.filepath,
        },
        this.getApiKey,
        this.abortController.signal
      )

      if (!completion) {
        return null
      }

      return new vscode.InlineCompletionList([
        new vscode.InlineCompletionItem(
          completion,
          new vscode.Range(position, position)
        ),
      ])
    } catch {
      return null
    }
  }
}
