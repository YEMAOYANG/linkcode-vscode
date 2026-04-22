import * as vscode from 'vscode'
import { fetchCompletion } from '../api/client'

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private abortController: AbortController | null = null

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

    // Extract context: up to 100 lines before cursor
    const startLine = Math.max(0, position.line - 100)
    const prefix = document.getText(
      new vscode.Range(
        new vscode.Position(startLine, 0),
        position
      )
    )

    // Extract suffix: up to 50 lines after cursor
    const endLine = Math.min(document.lineCount - 1, position.line + 50)
    const suffix = document.getText(
      new vscode.Range(
        position,
        new vscode.Position(endLine, document.lineAt(endLine).text.length)
      )
    )

    // Wire cancellation token to abort controller
    token.onCancellationRequested(() => this.abortController?.abort())

    try {
      const completion = await fetchCompletion(
        {
          prefix,
          suffix,
          language: document.languageId,
          filepath: document.uri.fsPath,
        },
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
