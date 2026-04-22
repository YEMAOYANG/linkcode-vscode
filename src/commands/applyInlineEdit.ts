import * as vscode from 'vscode'

/**
 * Apply an inline edit from AI suggestion to the active editor.
 * Uses WorkspaceEdit for undo support.
 */
export async function applyInlineEdit(
  uri: vscode.Uri,
  range: vscode.Range,
  newText: string
): Promise<boolean> {
  const edit = new vscode.WorkspaceEdit()
  edit.replace(uri, range, newText)
  return vscode.workspace.applyEdit(edit)
}
