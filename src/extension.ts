import * as vscode from 'vscode'
import { InlineCompletionProvider } from './providers/InlineCompletionProvider'
import { ChatViewProvider } from './providers/ChatViewProvider'
import { CodeLensProvider } from './providers/CodeLensProvider'
import { registerCommands } from './commands'
import { Logger } from './utils/logger'
import { SecretStore } from './utils/secretStorage'
import { ApiClient } from './api/client'
import { SECRET_KEY_API } from './shared/constants'

const API_KEY_CHECK_DELAY_MS = 500

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance(context)
  logger.info('LinkCode extension activated')

  // Secret storage for API key
  const secretStore = new SecretStore(context.secrets)
  const getApiKey = () => secretStore.getApiKey()

  // Auto-seed default API key on first install (only if not already set)
  const DEFAULT_API_KEY='***'
  void Promise.resolve(context.secrets.get(SECRET_KEY_API)).then((existing) => {
    if (!existing) {
      void Promise.resolve(context.secrets.store(SECRET_KEY_API, DEFAULT_API_KEY)).then(() => {
        logger.info('Default API key seeded into SecretStorage')
      }).catch((err: unknown) => {
        logger.error('Failed to seed default API key', err)
      })
    }
  }).catch((err: unknown) => {
    logger.error('Failed to check existing API key', err)
  })

  // Centralized API client — single instance shared by all providers
  const apiClient = new ApiClient(getApiKey)

  // Warn if API key is not set (check after seeding)
  const apiKeyCheckTimer = setTimeout(() => {
    void secretStore.getApiKey().then((key) => {
      if (!key) {
        void vscode.window
          .showWarningMessage(
            'LinkCode: API Key is not set. Please set it to use AI features.',
            'Set API Key'
          )
          .then((choice) => {
            if (choice === 'Set API Key') {
              void vscode.commands.executeCommand('linkcode.setApiKey')
            }
          })
      }
    })
  }, API_KEY_CHECK_DELAY_MS)
  context.subscriptions.push({ dispose: () => clearTimeout(apiKeyCheckTimer) })

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
