import * as vscode from 'vscode'

/**
 * Extract code context around the cursor for AI requests.
 */
export function extractContext(
  editor: vscode.TextEditor,
  maxLinesBefore = 100,
  maxLinesAfter = 50
): { prefix: string; suffix: string; language: string; filepath: string } {
  const document = editor.document
  const position = editor.selection.active

  const startLine = Math.max(0, position.line - maxLinesBefore)
  const endLine = Math.min(
    document.lineCount - 1,
    position.line + maxLinesAfter
  )

  const prefix = document.getText(
    new vscode.Range(new vscode.Position(startLine, 0), position)
  )

  const suffix = document.getText(
    new vscode.Range(
      position,
      new vscode.Position(endLine, document.lineAt(endLine).text.length)
    )
  )

  return {
    prefix,
    suffix,
    language: document.languageId,
    filepath: document.uri.fsPath,
  }
}

/**
 * Get the full text of the currently selected code (or the current line if nothing is selected).
 */
export function getSelectedCode(editor: vscode.TextEditor): string {
  const selection = editor.selection
  if (selection.isEmpty) {
    return editor.document.lineAt(selection.active.line).text
  }
  return editor.document.getText(selection)
}
