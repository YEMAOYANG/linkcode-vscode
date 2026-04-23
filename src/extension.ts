import * as vscode from 'vscode'
import { InlineCompletionProvider } from './providers/InlineCompletionProvider'
import { ChatViewProvider } from './providers/ChatViewProvider'
import { CodeLensProvider } from './providers/CodeLensProvider'
import { registerCommands } from './commands'
import { Logger } from './utils/logger'
import { SecretStore } from './utils/secretStorage'
import { ApiClient } from './api/client'
import { SECRET_KEY_API } from './shared/constants'

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance(context)
  logger.info('LinkCode extension activated')

  // Secret storage for API key
  const secretStore = new SecretStore(context.secrets)
  const getApiKey = () => secretStore.getApiKey()

  // Seed default API key into SecretStorage (only if not already set)
  context.secrets.get(SECRET_KEY_API).then((existing) => {
    if (!existing) {
      context.secrets.store(
        SECRET_KEY_API,
        'sk-iYhVnfY27MIdhT73A84eJpt3x7NMSbLMCjVJgWR5OLifKT1U'
      )
      logger.info('Default Smoothlink API key seeded into SecretStorage')
    }
  })

  // Centralized API client — single instance shared by all providers
  const apiClient = new ApiClient(getApiKey)

  // Warn if API key is not set (check after seeding)
  setTimeout(() => {
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
  }, 500)

  // Inline Completion (Ghost Text)
  const inlineProvider = new InlineCompletionProvider(apiClient)
  context.subscriptions.push(inlineProvider)
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  )

  // Chat WebView
  const chatProvider = new ChatViewProvider(context.extensionUri, apiClient, context.globalState)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'linkcode.chatView',
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  )

  // CodeLens
  const codeLensProvider = new CodeLensProvider()
  context.subscriptions.push(codeLensProvider)
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
