import * as vscode from 'vscode'
import type { ChatViewProvider } from '../providers/ChatViewProvider'
import type { SecretStore } from '../utils/secretStorage'
import { applyInlineEdit } from './applyInlineEdit'

export function registerCommands(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider,
  secretStore: SecretStore
): void {
  // Set API Key
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your LinkCode API Key',
        password: true,
        placeHolder: 'sk-...',
        ignoreFocusOut: true,
      })
      if (key !== undefined) {
        if (key === '') {
          await secretStore.deleteApiKey()
          vscode.window.showInformationMessage('LinkCode: API Key removed.')
        } else {
          await secretStore.setApiKey(key)
          vscode.window.showInformationMessage('LinkCode: API Key saved.')
        }
      }
    })
  )

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

  // Apply Inline Edit
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'linkcode.applyInlineEdit',
      async (uri: vscode.Uri, range: vscode.Range, newText: string) => {
        const success = await applyInlineEdit(uri, range, newText)
        if (!success) {
          vscode.window.showErrorMessage(
            'LinkCode: Failed to apply inline edit.'
          )
        }
      }
    )
  )

  // Explain Code
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'linkcode.explainCode',
      (document?: vscode.TextDocument, range?: vscode.Range) => {
        const editor = vscode.window.activeTextEditor
        const selectedText = getSelectedOrRangeText(editor, document, range)
        if (!selectedText) {
          vscode.window.showWarningMessage(
            'LinkCode: No code selected to explain.'
          )
          return
        }
        chatProvider.postMessage({
          type: 'user_action',
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
          vscode.window.showWarningMessage(
            'LinkCode: No code selected to refactor.'
          )
          return
        }
        chatProvider.postMessage({
          type: 'user_action',
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
