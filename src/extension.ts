import * as vscode from 'vscode'
import { InlineCompletionProvider } from './providers/InlineCompletionProvider'
import { ChatViewProvider } from './providers/ChatViewProvider'
import { CodeLensProvider } from './providers/CodeLensProvider'
import { registerCommands } from './commands'
import { Logger } from './utils/logger'

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance()
  logger.info('LinkCode extension activated')

  // Inline Completion (Ghost Text)
  const inlineProvider = new InlineCompletionProvider()
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  )

  // Chat WebView
  const chatProvider = new ChatViewProvider(context.extensionUri)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('linkcode.chatView', chatProvider)
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
  registerCommands(context, chatProvider)

  logger.info('LinkCode providers and commands registered')
}

export function deactivate(): void {
  Logger.getInstance().info('LinkCode extension deactivated')
}
