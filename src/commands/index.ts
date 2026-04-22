import * as vscode from 'vscode'
import type { ChatViewProvider } from '../providers/ChatViewProvider'

export function registerCommands(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider
): void {
  // Open Chat panel
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.openChat', () => {
      vscode.commands.executeCommand('linkcode.chatView.focus')
    })
  )

  // Accept Completion (handled natively by VS Code inline suggestions)
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.acceptCompletion', () => {
      vscode.commands.executeCommand('editor.action.inlineSuggest.commit')
    })
  )

  // Explain Code
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'linkcode.explainCode',
      (document?: vscode.TextDocument, range?: vscode.Range) => {
        const editor = vscode.window.activeTextEditor
        const selectedText = getSelectedOrRangeText(editor, document, range)
        if (!selectedText) {
          vscode.window.showWarningMessage('LinkCode: No code selected to explain.')
          return
        }
        chatProvider.postMessage({
          type: 'userAction',
          action: 'explain',
          payload: selectedText,
        })
        vscode.commands.executeCommand('linkcode.chatView.focus')
      }
    )
  )

  // Refactor Code
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'linkcode.refactorCode',
      (document?: vscode.TextDocument, range?: vscode.Range) => {
        const editor = vscode.window.activeTextEditor
        const selectedText = getSelectedOrRangeText(editor, document, range)
        if (!selectedText) {
          vscode.window.showWarningMessage('LinkCode: No code selected to refactor.')
          return
        }
        chatProvider.postMessage({
          type: 'userAction',
          action: 'refactor',
          payload: selectedText,
        })
        vscode.commands.executeCommand('linkcode.chatView.focus')
      }
    )
  )
}

function getSelectedOrRangeText(
  editor?: vscode.TextEditor,
  document?: vscode.TextDocument,
  range?: vscode.Range
): string | undefined {
  if (document && range) {
    return document.getText(range)
  }
  if (editor && !editor.selection.isEmpty) {
    return editor.document.getText(editor.selection)
  }
  return undefined
}
