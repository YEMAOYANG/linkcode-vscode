import * as vscode from 'vscode'
import { InlineCompletionProvider } from './providers/InlineCompletionProvider'
import { ChatViewProvider } from './providers/ChatViewProvider'
import { CodeLensProvider } from './providers/CodeLensProvider'
import { registerCommands } from './commands'
import { Logger } from './utils/logger'
import { SecretStore } from './utils/secretStorage'

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance(context)
  logger.info('LinkCode extension activated')

  // Secret storage for API key
  const secretStore = new SecretStore(context.secrets)
  const getApiKey = () => secretStore.getApiKey()

  // Warn if API key is not set
  secretStore.getApiKey().then((key) => {
    if (!key) {
      vscode.window
        .showWarningMessage(
          'LinkCode: API Key is not set. Please set it to use AI features.',
          'Set API Key'
        )
        .then((choice) => {
          if (choice === 'Set API Key') {
            vscode.commands.executeCommand('linkcode.setApiKey')
          }
        })
    }
  })

  // Inline Completion (Ghost Text)
  const inlineProvider = new InlineCompletionProvider(getApiKey)
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  )

  // Chat WebView
  const chatProvider = new ChatViewProvider(context.extensionUri, getApiKey)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('linkcode.chatView', chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  )

  // CodeLens
  const codeLensProvider = new CodeLensProvider()
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { pattern: '**' },
      codeLensProvider
    )
  )

  // Commands
  registerCommands(context, chatProvider, secretStore)

  logger.info('LinkCode providers and commands registered')
}

export function deactivate(): void {
  Logger.getInstance().info('LinkCode extension deactivated')
}
