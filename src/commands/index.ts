import * as vscode from 'vscode'
import type { ChatViewProvider } from '../providers/ChatViewProvider'
import type { SecretStore } from '../utils/secretStorage'
import { applyInlineEdit } from './applyInlineEdit'

export function registerCommands(
  context: vscode.ExtensionContext,
  chatProvider: ChatViewProvider,
  secretStore: SecretStore
): void {
  // Set API Key (interactive dialog)
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

  // Set API Key directly (from WebView, no dialog)
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.setApiKeyDirect', async (key: string) => {
      if (key) {
        await secretStore.setApiKey(key)
      }
    })
  )

  // Open Chat panel
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.openChat', () => {
      vscode.commands.executeCommand('linkcode.chatView.focus')
    })
  )

  // Toggle Inline Completion on/off
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.toggleCompletion', () => {
      const config = vscode.workspace.getConfiguration('linkcode')
      const current = config.get<boolean>('enableInlineCompletion', true)
      void config.update('enableInlineCompletion', !current, vscode.ConfigurationTarget.Global)
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
        chatProvider.handleUserAction('explain', selectedText)
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
        chatProvider.handleUserAction('refactor', selectedText)
        vscode.commands.executeCommand('linkcode.chatView.focus')
      }
    )
  )

  // Add selected code to Chat (quote)
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.addToChat', () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('LinkCode: 请先选中代码')
        return
      }
      const selectedText = editor.document.getText(editor.selection)
      const language = editor.document.languageId
      chatProvider.quoteCodeToChat(selectedText, language)
      vscode.commands.executeCommand('linkcode.chatView.focus')
    })
  )

  // Inline Edit — send selected code to WebView inline edit panel
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.inlineEdit', () => {
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('LinkCode: 请先选中代码')
        return
      }
      const selectedText = editor.document.getText(editor.selection)
      const language = editor.document.languageId
      const filepath = vscode.workspace.asRelativePath(editor.document.uri)
      chatProvider.sendInlineEditContext(selectedText, language, filepath)
      vscode.commands.executeCommand('linkcode.chatView.focus')
    })
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
