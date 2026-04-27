import * as vscode from 'vscode'
import { InlineCompletionProvider } from './providers/InlineCompletionProvider'
import { ChatViewProvider } from './providers/ChatViewProvider'
import { CodeLensProvider } from './providers/CodeLensProvider'
import { registerCommands } from './commands'
import { Logger } from './utils/logger'
import { SecretStore } from './utils/secretStorage'
import { ApiClient } from './api/client'
import { SECRET_KEY_API } from './shared/constants'
import { DiffController } from './diff/DiffController'

export function activate(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance(context)
  logger.info('LinkCode extension activated')

  try {
    _activate(context, logger)
    logger.info('LinkCode providers and commands registered')
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
    logger.error(`[activate] Fatal error during activation: ${msg}`)
    vscode.window.showErrorMessage(`LinkCode 激活失败：${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

function _activate(context: vscode.ExtensionContext, logger: Logger): void {
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
  const apiClient = new ApiClient(getApiKey, secretStore)

  // Onboarding is now handled by the WebView via show_onboarding message.
  // The ChatViewProvider checks for API key on ready and sends the trigger.

  // Status Bar — Ghost Text indicator
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBar.text = '$(sparkle) LinkCode'
  statusBar.tooltip = 'LinkCode: Ready — Click to toggle inline completion'
  statusBar.command = 'linkcode.toggleCompletion'
  statusBar.show()
  context.subscriptions.push(statusBar)

  function shortModelLabel(id: string): string {
    if (id.startsWith('claude-haiku')) return 'Haiku 4.5'
    if (id.startsWith('claude-sonnet')) return 'Sonnet 4.6'
    if (id.startsWith('claude-opus')) return 'Opus 4.6'
    if (id.startsWith('gemini-2.5-flash-lite')) return 'Gemini Flash Lite'
    if (id.startsWith('gemini-2.5-flash')) return 'Gemini 2.5 Flash'
    if (id.startsWith('gemini-2.5-pro')) return 'Gemini 2.5 Pro'
    if (id.startsWith('gpt-5.1-codex')) return 'GPT-5.1 Codex'
    if (id.startsWith('deepseek-v3')) return 'DeepSeek V3'
    if (id.startsWith('qwen')) return id
    return id.length > 18 ? id.slice(0, 16) + '…' : id
  }

  async function renderStatus(extra?: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('linkcode')
    const enabled = config.get<boolean>('enableInlineCompletion', true)
    const status = apiClient.getCompletionStatus()

    if (!enabled) {
      statusBar.text = '$(circle-slash) LinkCode'
      statusBar.tooltip = 'LinkCode: 补全已关闭 — 点击开启'
      return
    }

    if (!status) {
      statusBar.text = '$(sparkle) LinkCode'
      statusBar.tooltip = 'LinkCode: 就绪，尚未发起补全'
      return
    }

    if (status.reason && status.reason.includes('no token')) {
      statusBar.text = '$(warning) LinkCode · 未配置'
      statusBar.tooltip = new vscode.MarkdownString(
        [
          '**LinkCode · 补全未配置**',
          '',
          '当前没有任何分组 token 可用。',
          '',
          '- 点击状态栏或打开设置配置分组令牌',
          '- 补全暂时不可用',
        ].join('\n'),
      )
      return
    }

    const label = shortModelLabel(status.actual)
    statusBar.text = status.degraded
      ? `$(sparkle) LinkCode · ${label} (降级)`
      : `$(sparkle) LinkCode · ${label}`

    const md = new vscode.MarkdownString()
    md.isTrusted = true
    md.appendMarkdown(`**LinkCode · 补全模型**\n\n`)
    md.appendMarkdown(`- 请求模型：\`${status.requested}\`\n`)
    md.appendMarkdown(`- 实际模型：\`${status.actual}\`${status.degraded ? ' _(降级)_' : ''}\n`)
    if (status.reason) md.appendMarkdown(`- 说明：${status.reason}\n`)
    if (extra) md.appendMarkdown(`\n${extra}`)
    md.appendMarkdown('\n\n---\n**快捷键**\n\n')
    md.appendMarkdown('| 操作 | 按键 |\n')
    md.appendMarkdown('| --- | --- |\n')
    md.appendMarkdown('| 接受全部 | `Tab` |\n')
    md.appendMarkdown('| 接受下一词 | `Ctrl/Cmd + →` |\n')
    md.appendMarkdown('| 接受下一行 | `Ctrl/Cmd + Shift + →` |\n')
    md.appendMarkdown('| 拒绝 | `Esc` / 继续输入 |\n')
    statusBar.tooltip = md
  }

  // Inline Completion (Ghost Text)
  const inlineProvider = new InlineCompletionProvider(apiClient)
  context.subscriptions.push(inlineProvider)
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineProvider
    )
  )

  apiClient.onCompletionStatus(() => void renderStatus())
  void renderStatus()

  // Update status bar when completion state changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('linkcode.enableInlineCompletion') ||
        e.affectsConfiguration('linkcode.completionModel')
      ) {
        void renderStatus()
      }
    })
  )

  // Chat WebView
  const chatProvider = new ChatViewProvider(context.extensionUri, apiClient, context.globalState)
  chatProvider.setSecretStore(secretStore)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'linkcode.chatView',
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  )

  // Phase 5B: Cursor-style inline diff controller
  const diffController = new DiffController((m) => chatProvider.postMessage(m as never))
  chatProvider.setDiffController(diffController)
  context.subscriptions.push(diffController)

  // Phase 5C: hunk-level command dispatch
  context.subscriptions.push(
    vscode.commands.registerCommand('linkcode.acceptHunk', (sid: string, hid: string) =>
      diffController.acceptHunk(sid, hid),
    ),
    vscode.commands.registerCommand('linkcode.rejectHunk', (sid: string, hid: string) =>
      diffController.rejectHunk(sid, hid),
    ),
    vscode.commands.registerCommand('linkcode.acceptAllHunks', async (sid?: string) => {
      const id = sid ?? diffController.resolveActiveSessionId()
      if (id) await diffController.acceptAll(id)
    }),
    vscode.commands.registerCommand('linkcode.rejectAllHunks', async (sid?: string) => {
      const id = sid ?? diffController.resolveActiveSessionId()
      if (id) await diffController.rejectAll(id)
    }),
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
}

export function deactivate(): void {
  Logger.getInstance().info('LinkCode extension deactivated')
}
