import * as vscode from 'vscode'
import { MAX_CONTEXT_LINES_BEFORE, MAX_CONTEXT_LINES_AFTER } from '../shared/constants'

interface CompletionContext {
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
): CompletionContext
export function extractContext(
  document: vscode.TextDocument,
  position: vscode.Position,
  maxLinesBefore?: number,
  maxLinesAfter?: number
): CompletionContext
export function extractContext(
  editorOrDoc: vscode.TextEditor | vscode.TextDocument,
  positionOrMaxBefore?: vscode.Position | number,
  maxLinesBeforeOrAfter?: number,
  maxLinesAfterArg?: number
): CompletionContext {
  let document: vscode.TextDocument
  let position: vscode.Position
  let maxLinesBefore: number
  let maxLinesAfter: number

  if ('document' in editorOrDoc) {
    // TextEditor overload
    document = editorOrDoc.document
    position = editorOrDoc.selection.active
    maxLinesBefore = (positionOrMaxBefore as number | undefined) ?? MAX_CONTEXT_LINES_BEFORE
    maxLinesAfter = maxLinesBeforeOrAfter ?? MAX_CONTEXT_LINES_AFTER
  } else {
    // TextDocument + Position overload
    document = editorOrDoc
    position = positionOrMaxBefore as vscode.Position
    maxLinesBefore = maxLinesBeforeOrAfter ?? MAX_CONTEXT_LINES_BEFORE
    maxLinesAfter = maxLinesAfterArg ?? MAX_CONTEXT_LINES_AFTER
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
