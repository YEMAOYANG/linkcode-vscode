import * as vscode from 'vscode'

export interface CodeContext {
  prefix: string
  suffix: string
  language: string
  filepath: string
}

/**
 * Extract code context around the cursor for AI requests.
 * Overload: accepts TextEditor or TextDocument + Position.
 */
export function extractContext(
  editor: vscode.TextEditor,
  maxLinesBefore?: number,
  maxLinesAfter?: number
): CodeContext
export function extractContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxLinesBefore?: number,
  maxLinesAfter?: number
): CodeContext
export function extractContext(
  editorOrDoc: vscode.TextEditor | vscode.TextDocument,
  positionOrMaxBefore?: vscode.Position | number,
  maxLinesBeforeOrAfter?: number,
  maxLinesAfterArg?: number
): CodeContext {
  let document: vscode.TextDocument
  let position: vscode.Position
  let maxLinesBefore: number
  let maxLinesAfter: number

  if ('document' in editorOrDoc) {
    // TextEditor overload
    document = editorOrDoc.document
    position = editorOrDoc.selection.active
    maxLinesBefore = (positionOrMaxBefore as number | undefined) ?? 100
    maxLinesAfter = maxLinesBeforeOrAfter ?? 50
  } else {
    // TextDocument + Position overload
    document = editorOrDoc
    position = positionOrMaxBefore as vscode.Position
    maxLinesBefore = maxLinesBeforeOrAfter ?? 100
    maxLinesAfter = maxLinesAfterArg ?? 50
  }

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
