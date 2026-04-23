import * as vscode from 'vscode'
import type { ExtToWebMsg, WebToExtMsg, StoredChatMessage, ApiModelInfo } from '../shared/types'
import type { ChatMessage } from '../api/types'
import type { ApiClient } from '../api/client'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'
import { CONFIG_SECTION, DEFAULT_MODEL, DEFAULT_API_ENDPOINT, RECOMMENDED_MODELS } from '../shared/constants'

const HISTORY_KEY = 'linkcode.chatHistory'
const MODEL_FETCH_TIMEOUT_MS = 10_000

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'linkcode.chatView'

  private _view?: vscode.WebviewView
  private _abortController?: AbortController
  private _chatHistory: ChatMessage[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiClient: ApiClient,
    private readonly globalState: vscode.Memento
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
      ],
    }

    webviewView.webview.html = this._getHtml(webviewView.webview)

    // Handle messages from the WebView — dispose with the view
    const messageDisposable = webviewView.webview.onDidReceiveMessage((msg: WebToExtMsg) => {
      switch (msg.type) {
        case 'sendMessage':
          this._handleSendMessage(msg.text)
          break
        case 'ready':
          // WebView is ready — send current model info, fetch models, check onboarding
          this._sendModelInfo()
          this._fetchModels()
          this._checkOnboarding()
          break
        case 'getHistory':
          this._sendHistory()
          break
        case 'saveMessages':
          this._saveHistory(msg.messages)
          break
        case 'changeModel':
          this._handleChangeModel(msg.modelId)
          break
        case 'newChat':
          this._handleNewChat()
          break
        case 'applyEdit':
          this._handleApplyEdit(msg.code)
          break
        case 'setApiKey':
          this._handleSetApiKey(msg.key)
          break
        case 'validateApiKey':
          this._handleValidateApiKey(msg.key)
          break
        case 'updateConfig':
          this._handleUpdateConfig(msg.key, msg.value)
          break
        case 'onboardingComplete':
          // Extension can react to onboarding completion if needed
          break
      }
    })

    // Listen for config changes and notify webview
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.model`)) {
        this._sendModelInfo()
      }
    })

    // Clean up listener when the view is disposed
    webviewView.onDidDispose(() => {
      messageDisposable.dispose()
      configDisposable.dispose()
      this._abortController?.abort()
      this._view = undefined
    })
  }

  /**
   * Send a typed message to the WebView.
   */
  public postMessage(message: ExtToWebMsg): void {
    this._view?.webview.postMessage(message)
  }

  /**
   * Handle a CodeLens/command action by sending it to the webview
   * and triggering the chat flow.
   */
  public handleUserAction(action: 'explain' | 'refactor' | 'review', payload: string): void {
    // Notify webview to display the user action
    this.postMessage({
      type: 'user_action',
      action,
      payload,
    })
    // Actually trigger the chat API call
    const prompt = `[${action}]\n${payload}`
    this._handleSendMessage(prompt)
  }

  /** Send current model info to webview */
  private _sendModelInfo(): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const model = config.get<string>('model') ?? DEFAULT_MODEL
    this._view?.webview.postMessage({
      type: 'modelInfo',
      modelId: model,
    })
  }

  /** Handle model change from webview */
  private _handleChangeModel(modelId: string): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    void Promise.resolve(config.update('model', modelId, vscode.ConfigurationTarget.Global))
  }

  /**
   * Fetch available models from the Smoothlink API and push to WebView.
   * Falls back to RECOMMENDED_MODELS on failure.
   */
  private async _fetchModels(): Promise<void> {
    const logger = Logger.getInstance()
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const endpoint = config.get<string>('apiEndpoint') ?? DEFAULT_API_ENDPOINT

    try {
      // Try to get API key — group-specific tokens or general key
      let apiKey: string | undefined
      const tokens = config.get<Record<string, string>>('apiTokens') ?? {}
      // Use any available token for the models list request
      const tokenValues = Object.values(tokens)
      if (tokenValues.length > 0) {
        apiKey = tokenValues[0]
      }
      if (!apiKey) {
        // Fall back to the general API key from SecretStorage via apiClient
        // We'll just use the apiClient's getApiKey
        apiKey = await this._getApiKeyForModels()
      }

      if (!apiKey) {
        logger.warn('[fetchModels] No API key available, using fallback models')
        this._sendFallbackModels()
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

      try {
        const res = await fetch(`${endpoint}/v1/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        if (!res.ok) {
          logger.warn(`[fetchModels] API returned ${res.status}, using fallback`)
          this._sendFallbackModels()
          return
        }

        const data = (await res.json()) as {
          data?: Array<{ id: string; object?: string }>
        }

        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          logger.warn('[fetchModels] Empty response, using fallback')
          this._sendFallbackModels()
          return
        }

        const models: ApiModelInfo[] = data.data.map((m) => ({
          id: m.id,
          label: m.id,
          provider: ChatViewProvider._inferProvider(m.id),
        }))

        logger.info(`[fetchModels] Got ${models.length} models from API`)
        this.postMessage({ type: 'modelList', models })
      } finally {
        clearTimeout(timeout)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('[fetchModels] Request timed out, using fallback')
      } else {
        logger.error('[fetchModels] Failed to fetch models', err)
      }
      this._sendFallbackModels()
    }
  }

  /** Send fallback model list from constants */
  private _sendFallbackModels(): void {
    const models: ApiModelInfo[] = RECOMMENDED_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      tag: m.tag || undefined,
    }))
    this.postMessage({ type: 'modelList', models })
  }

  /** Try to retrieve an API key for the models endpoint */
  private async _getApiKeyForModels(): Promise<string | undefined> {
    try {
      return await this.apiClient.resolveApiKey()
    } catch {
      return undefined
    }
  }

  /** Infer provider name from model ID */
  private static _inferProvider(id: string): string {
    if (id.startsWith('claude')) return 'Anthropic'
    if (id.startsWith('gpt') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')) return 'OpenAI'
    if (id.startsWith('gemini')) return 'Google'
    if (id.startsWith('deepseek')) return 'DeepSeek'
    if (id.startsWith('qwen')) return 'Qwen'
    if (id.startsWith('glm') || id.startsWith('chatglm')) return 'GLM'
    if (id.startsWith('hunyuan')) return 'HunYuan'
    if (id.startsWith('kimi') || id.startsWith('moonshot')) return 'Kimi'
    if (id.startsWith('minimax')) return 'MiniMax'
    if (id.startsWith('doubao')) return 'Doubao'
    return 'Other'
  }

  /** Handle new chat request from webview */
  private _handleNewChat(): void {
    this._chatHistory = []
    this._abortController?.abort()
    this.postMessage({ type: 'chatCleared' })
  }

  /** Apply code from chat to the active editor */
  private _handleApplyEdit(code: string): void {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('LinkCode: No active editor to apply code to.')
      return
    }
    const selection = editor.selection
    const range = selection.isEmpty
      ? new vscode.Range(selection.active, selection.active)
      : selection
    const edit = new vscode.WorkspaceEdit()
    edit.replace(editor.document.uri, range, code)
    void Promise.resolve(vscode.workspace.applyEdit(edit))
  }

  /** Load persisted messages and send to webview, also restore extension-side chat history */
  private _sendHistory(): void {
    const stored = this.globalState.get<StoredChatMessage[]>(HISTORY_KEY, [])
    this._view?.webview.postMessage({
      type: 'loadHistory',
      messages: stored,
    })

    // Restore extension-side chat history so API calls have full context
    this._chatHistory = stored.map((m) => ({
      role: m.role,
      content: m.content,
    }))
  }

  /** Save messages from webview to globalState */
  private _saveHistory(messages: StoredChatMessage[]): void {
    void Promise.resolve(this.globalState.update(HISTORY_KEY, messages))
  }

  private async _handleSendMessage(text: string): Promise<void> {
    const logger = Logger.getInstance()

    // Add user message to history
    this._chatHistory.push({ role: 'user', content: text })

    // Cancel any in-flight stream
    this._abortController?.abort()
    this._abortController = new AbortController()

    this.postMessage({ type: 'stream_start' })

    try {
      let assistantContent = ''
      let lastUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined

      for await (const chunk of this.apiClient.streamChat(
        this._chatHistory,
        this._abortController.signal
      )) {
        if (chunk.type === 'token' && chunk.content) {
          assistantContent += chunk.content
          this.postMessage({ type: 'stream_chunk', content: chunk.content })
        } else if (chunk.type === 'error') {
          this.postMessage({
            type: 'stream_error',
            message: chunk.error ?? 'Unknown error',
          })
          logger.error(`Stream error: ${chunk.error}`)
          return
        } else if (chunk.type === 'done') {
          if (chunk.usage) {
            lastUsage = chunk.usage
          }
          break
        }
      }

      // Save assistant response to history
      this._chatHistory.push({ role: 'assistant', content: assistantContent })
      this.postMessage({ type: 'stream_end', usage: lastUsage })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.postMessage({ type: 'stream_end' })
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.postMessage({ type: 'stream_error', message: errorMessage })
      logger.error('Chat stream failed', err)
    }
  }

  /** Check if onboarding should be shown (no API key set) */
  private async _checkOnboarding(): Promise<void> {
    try {
      const apiKey = await this.apiClient.resolveApiKey()
      if (!apiKey) {
        this.postMessage({ type: 'show_onboarding' })
      }
    } catch {
      this.postMessage({ type: 'show_onboarding' })
    }
  }

  /** Handle setApiKey from WebView (onboarding / settings) */
  private _handleSetApiKey(key: string): void {
    void vscode.commands.executeCommand('linkcode.setApiKeyDirect', key)
  }

  /** Handle validateApiKey — test against /v1/models */
  private async _handleValidateApiKey(key: string): Promise<void> {
    const logger = Logger.getInstance()
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const endpoint = config.get<string>('apiEndpoint') ?? DEFAULT_API_ENDPOINT

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT_MS)

      try {
        const res = await fetch(`${endpoint}/v1/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        if (res.ok) {
          this.postMessage({ type: 'apiKeyValidated', success: true })
          // Also fetch models with the new key
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const models: ApiModelInfo[] = data.data.map((m) => ({
              id: m.id,
              label: m.id,
              provider: ChatViewProvider._inferProvider(m.id),
            }))
            this.postMessage({ type: 'modelList', models })
          }
        } else {
          this.postMessage({ type: 'apiKeyValidated', success: false, message: `HTTP ${res.status}` })
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error('[validateApiKey] Failed', err)
      this.postMessage({ type: 'apiKeyValidated', success: false, message })
    }
  }

  /** Handle config update from WebView (settings page) */
  private _handleUpdateConfig(key: string, value: unknown): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    void Promise.resolve(config.update(key, value, vscode.ConfigurationTarget.Global))
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'style.css')
    )
    const nonce = getNonce()

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; connect-src https://smoothlink.ai;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>LinkCode Chat</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }
}
