import * as vscode from 'vscode'
import type { ExtToWebMsg, WebToExtMsg, StoredChatMessage, ApiModelInfo, SessionSummary } from '../shared/types'
import type { ChatMessage } from '../api/types'
import type { ApiClient } from '../api/client'
import type { SecretStore } from '../utils/secretStorage'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'
import { AuthError, ApiError } from '../shared/errors'
import { CONFIG_SECTION, DEFAULT_MODEL, DEFAULT_API_ENDPOINT, RECOMMENDED_MODELS, MODEL_TO_GROUP, TOKEN_GROUPS } from '../shared/constants'

const HISTORY_KEY = 'linkcode.chatHistory'
const SESSION_LIST_KEY = 'linkcode.sessionList'
const MODEL_FETCH_TIMEOUT_MS = 10_000

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'linkcode.chatView'

  private _view?: vscode.WebviewView
  private _abortController?: AbortController
  private _chatHistory: ChatMessage[] = []
  private _attachedFiles: Array<{ name: string; content: string }> = []
  private _secretStore?: SecretStore

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiClient: ApiClient,
    private readonly globalState: vscode.Memento
  ) {}

  /** Inject SecretStore for group token management */
  public setSecretStore(store: SecretStore): void {
    this._secretStore = store
  }

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

    const messageDisposable = webviewView.webview.onDidReceiveMessage((msg: WebToExtMsg) => {
      switch (msg.type) {
        case 'sendMessage':
          this._handleSendMessage(msg.text)
          break
        case 'ready':
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
          break
        case 'feedback': {
          const fbMsg = msg as { type: 'feedback'; messageId?: string; rating: string; category: string }
          Logger.getInstance().info(`[feedback] messageId=${fbMsg.messageId} rating=${fbMsg.rating} category=${fbMsg.category}`)
          break
        }
        case 'getRecentFiles':
          this._handleGetRecentFiles()
          break
        case 'attachFile': {
          const attachMsg = msg as { type: 'attachFile'; name: string; content: string }
          this._attachedFiles.push({ name: attachMsg.name, content: attachMsg.content })
          break
        }
        case 'startCodeReview':
          this._handleCodeReview()
          break
        case 'inlineEditRequest': {
          const ieMsg = msg as { type: 'inlineEditRequest'; instruction: string; code: string }
          this._handleInlineEditRequest(ieMsg.instruction, ieMsg.code)
          break
        }
        case 'inlineEditAccept': {
          const acceptMsg = msg as { type: 'inlineEditAccept'; code: string }
          this._handleApplyEdit(acceptMsg.code)
          break
        }
        case 'githubLogin':
          Logger.getInstance().info('[githubLogin] GitHub login requested')
          break
        // Task 1: Multi-token management
        case 'setGroupToken': {
          const gtMsg = msg as { type: 'setGroupToken'; group: string; token: string }
          this._handleSetGroupToken(gtMsg.group, gtMsg.token)
          break
        }
        case 'validateGroupToken': {
          const vtMsg = msg as { type: 'validateGroupToken'; group: string; token: string }
          this._handleValidateGroupToken(vtMsg.group, vtMsg.token)
          break
        }
        case 'getGroupTokenStatus':
          this._handleGetGroupTokenStatus()
          break
        // Feature 2: openSettings from webview
        case 'openSettings': {
          const osMsg = msg as { type: 'openSettings'; tab?: string; highlightGroup?: string }
          this.postMessage({ type: 'open_settings', tab: osMsg.tab, highlightGroup: osMsg.highlightGroup })
          break
        }
        // Feature 5: deleteGroupToken
        case 'deleteGroupToken': {
          const dgMsg = msg as { type: 'deleteGroupToken'; group: string }
          this._handleDeleteGroupToken(dgMsg.group)
          break
        }
        // Feature 5: openExternal
        case 'openExternal': {
          const oeMsg = msg as { type: 'openExternal'; url: string }
          void vscode.env.openExternal(vscode.Uri.parse(oeMsg.url))
          break
        }
        // Task 3: File content
        case 'getFileContent': {
          const fcMsg = msg as { type: 'getFileContent'; filepath: string }
          this._handleGetFileContent(fcMsg.filepath)
          break
        }
        // Task 4: Session history
        case 'getSessionHistory':
          this._handleGetSessionHistory()
          break
        case 'loadSession': {
          const lsMsg = msg as { type: 'loadSession'; sessionId: string }
          this._handleLoadSession(lsMsg.sessionId)
          break
        }
      }
    })

    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${CONFIG_SECTION}.model`)) {
        this._sendModelInfo()
      }
    })

    webviewView.onDidDispose(() => {
      messageDisposable.dispose()
      configDisposable.dispose()
      this._abortController?.abort()
      this._view = undefined
    })
  }

  public postMessage(message: ExtToWebMsg): void {
    this._view?.webview.postMessage(message)
  }

  public handleUserAction(action: 'explain' | 'refactor' | 'review', payload: string): void {
    this.postMessage({ type: 'user_action', action, payload })
    const prompt = `[${action}]\n${payload}`
    this._handleSendMessage(prompt)
  }

  private _sendModelInfo(): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const model = config.get<string>('model') ?? DEFAULT_MODEL
    this._view?.webview.postMessage({ type: 'modelInfo', modelId: model })
  }

  private _handleChangeModel(modelId: string): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    void Promise.resolve(config.update('model', modelId, vscode.ConfigurationTarget.Global))
  }

  private async _fetchModels(): Promise<void> {
    const logger = Logger.getInstance()
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const endpoint = config.get<string>('apiEndpoint') ?? DEFAULT_API_ENDPOINT

    try {
      let apiKey: string | undefined
      const tokens = config.get<Record<string, string>>('apiTokens') ?? {}
      const tokenValues = Object.values(tokens)
      if (tokenValues.length > 0) {
        apiKey = tokenValues[0]
      }
      if (!apiKey) {
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

  private _sendFallbackModels(): void {
    const models: ApiModelInfo[] = RECOMMENDED_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      provider: m.provider,
      tag: m.tag || undefined,
    }))
    this.postMessage({ type: 'modelList', models })
  }

  private async _getApiKeyForModels(): Promise<string | undefined> {
    try {
      return await this.apiClient.resolveApiKey()
    } catch {
      return undefined
    }
  }

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

  private _handleNewChat(): void {
    // Save current session before clearing
    this._saveCurrentSession()
    this._chatHistory = []
    this._abortController?.abort()
    this.postMessage({ type: 'chatCleared' })
  }

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

  private _sendHistory(): void {
    const stored = this.globalState.get<StoredChatMessage[]>(HISTORY_KEY, [])
    this._view?.webview.postMessage({ type: 'loadHistory', messages: stored })
    this._chatHistory = stored.map((m) => ({ role: m.role, content: m.content }))
  }

  private _saveHistory(messages: StoredChatMessage[]): void {
    void Promise.resolve(this.globalState.update(HISTORY_KEY, messages))
  }

  /** Task 2: File attachments are now injected into the user message */
  private async _handleSendMessage(text: string): Promise<void> {
    const logger = Logger.getInstance()

    // Build file context from attached files
    const fileContext = this._attachedFiles
      .filter(f => f.content)
      .map(f => `\n\n--- 附件: ${f.name} ---\n\`\`\`\n${f.content}\n\`\`\``)
      .join('')

    const fullContent = text + fileContext
    this._attachedFiles = [] // Clear after use

    this._chatHistory.push({ role: 'user', content: fullContent })

    this._abortController?.abort()
    this._abortController = new AbortController()

    this.postMessage({ type: 'stream_start' })

    try {
      // Check token availability before streaming
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
      const model = config.get<string>('model') ?? DEFAULT_MODEL
      const group = MODEL_TO_GROUP[model]

      if (group && this._secretStore) {
        const groupToken = await this._secretStore.getGroupToken(group)
        const generalKey = await this.apiClient.resolveApiKey()
        if (!groupToken && !generalKey) {
          this.postMessage({ type: 'tokenMissing', group, model })
          this.postMessage({ type: 'stream_end' })
          return
        }
      }

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

      this._chatHistory.push({ role: 'assistant', content: assistantContent })
      this.postMessage({ type: 'stream_end', usage: lastUsage })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.postMessage({ type: 'stream_end' })
        return
      }
      // Task 5: Send tokenInvalid on 401 when token existed, show_login when no token
      if (err instanceof AuthError) {
        this.postMessage({ type: 'show_login' })
      } else if (err instanceof ApiError && err.status === 401) {
        const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
        const model = config.get<string>('model') ?? DEFAULT_MODEL
        const group = MODEL_TO_GROUP[model] ?? 'unknown'
        this.postMessage({ type: 'tokenInvalid', group })
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.postMessage({ type: 'stream_error', message: errorMessage })
      logger.error('Chat stream failed', err)
    }
  }

  private async _checkOnboarding(): Promise<void> {
    try {
      const apiKey = await this.apiClient.resolveApiKey()
      if (!apiKey) {
        // Also check if any group tokens exist
        if (this._secretStore) {
          const groups = TOKEN_GROUPS.map(g => g.id)
          const status = await this._secretStore.getGroupTokenStatus(groups)
          const hasAnyToken = Object.values(status).some(Boolean)
          if (!hasAnyToken) {
            this.postMessage({ type: 'show_onboarding' })
          }
        } else {
          this.postMessage({ type: 'show_onboarding' })
        }
      }
    } catch {
      this.postMessage({ type: 'show_onboarding' })
    }
  }

  private _handleSetApiKey(key: string): void {
    void vscode.commands.executeCommand('linkcode.setApiKeyDirect', key)
  }

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

  private _handleUpdateConfig(key: string, value: unknown): void {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    void Promise.resolve(config.update(key, value, vscode.ConfigurationTarget.Global))
  }

  /** Task 1b: Store group token in SecretStorage */
  private async _handleSetGroupToken(group: string, token: string): Promise<void> {
    if (!this._secretStore) return
    await this._secretStore.setGroupToken(group, token)
    Logger.getInstance().info(`[setGroupToken] Saved token for group: ${group}`)
  }

  /** Task 1b: Validate a group token against /v1/models */
  private async _handleValidateGroupToken(group: string, token: string): Promise<void> {
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
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          const modelIds = data.data?.map(m => m.id) ?? []
          this.postMessage({
            type: 'groupTokenValidated',
            group,
            success: true,
            models: modelIds,
          })
        } else {
          this.postMessage({
            type: 'groupTokenValidated',
            group,
            success: false,
            message: `HTTP ${res.status}`,
          })
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error(`[validateGroupToken] Failed for ${group}`, err)
      this.postMessage({
        type: 'groupTokenValidated',
        group,
        success: false,
        message,
      })
    }
  }

  /** Task 1b: Return which groups have tokens configured */
  private async _handleGetGroupTokenStatus(): Promise<void> {
    if (!this._secretStore) {
      this.postMessage({ type: 'groupTokenStatus', tokens: {} })
      return
    }
    const groups = TOKEN_GROUPS.map(g => g.id)
    const status = await this._secretStore.getGroupTokenStatus(groups)
    this.postMessage({ type: 'groupTokenStatus', tokens: status })
  }

  /** Feature 5: Delete a group token */
  private async _handleDeleteGroupToken(group: string): Promise<void> {
    if (!this._secretStore) return
    await this._secretStore.deleteGroupToken(group)
    Logger.getInstance().info(`[deleteGroupToken] Deleted token for group: ${group}`)
    // Refresh status
    await this._handleGetGroupTokenStatus()
  }

  private _handleGetRecentFiles(): void {
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs)
    const files: Array<{ name: string; path: string }> = []
    const seen = new Set<string>()

    for (const tab of tabs) {
      const input = tab.input
      if (input && typeof input === 'object' && 'uri' in input) {
        const uri = (input as { uri: vscode.Uri }).uri
        if (uri.scheme === 'file' && !seen.has(uri.fsPath)) {
          seen.add(uri.fsPath)
          const segments = uri.fsPath.split('/')
          files.push({ name: segments[segments.length - 1] ?? uri.fsPath, path: uri.fsPath })
        }
      }
    }

    this.postMessage({ type: 'recentFiles', files: files.slice(0, 20) })
  }

  /** Task 3: Read file content and send to webview */
  private async _handleGetFileContent(filepath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filepath)
      const content = await vscode.workspace.fs.readFile(uri)
      const text = new TextDecoder().decode(content)
      const segments = filepath.split('/')
      const name = segments[segments.length - 1] ?? filepath
      this.postMessage({ type: 'fileContent', filepath, content: text, name })
    } catch (err: unknown) {
      Logger.getInstance().error(`[getFileContent] Failed to read ${filepath}`, err)
    }
  }

  /** Task 4: Save current session to history list */
  private _saveCurrentSession(): void {
    if (this._chatHistory.length === 0) return

    const firstUserMsg = this._chatHistory.find(m => m.role === 'user')
    if (!firstUserMsg) return

    const title = firstUserMsg.content.slice(0, 60).replace(/\n/g, ' ')
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    const model = config.get<string>('model') ?? DEFAULT_MODEL

    const session: SessionSummary = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title,
      messageCount: this._chatHistory.length,
      timestamp: Date.now(),
      model,
    }

    const sessions = this.globalState.get<SessionSummary[]>(SESSION_LIST_KEY, [])
    sessions.unshift(session)
    // Keep only last 50 sessions
    const trimmed = sessions.slice(0, 50)
    void Promise.resolve(this.globalState.update(SESSION_LIST_KEY, trimmed))

    // Save messages under session-specific key
    const storedMessages: StoredChatMessage[] = this._chatHistory.map((m, i) => ({
      id: `${session.id}-${i}`,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    void Promise.resolve(this.globalState.update(`linkcode.session.${session.id}`, storedMessages))
  }

  /** Task 4: Send session history list to webview */
  private _handleGetSessionHistory(): void {
    const sessions = this.globalState.get<SessionSummary[]>(SESSION_LIST_KEY, [])
    this.postMessage({ type: 'historyList', sessions })
  }

  /** Task 4: Load a specific session */
  private _handleLoadSession(sessionId: string): void {
    const stored = this.globalState.get<StoredChatMessage[]>(`linkcode.session.${sessionId}`, [])
    this._chatHistory = stored.map((m) => ({ role: m.role, content: m.content }))
    this._view?.webview.postMessage({ type: 'loadHistory', messages: stored })
  }

  private async _handleCodeReview(): Promise<void> {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('LinkCode: No active editor to review.')
      return
    }

    const code = editor.document.getText()
    const fileName = editor.document.fileName.split('/').pop() ?? 'unknown'
    const language = editor.document.languageId

    this.postMessage({ type: 'code_review_start', fileName })

    this._abortController?.abort()
    this._abortController = new AbortController()

    const messages = [
      { role: 'user' as const, content: `请对以下 ${language} 代码进行代码审查。指出 bug、性能问题、安全隐患和改进建议。\n\n文件: ${fileName}\n\n\`\`\`${language}\n${code}\n\`\`\`` },
    ]

    try {
      for await (const chunk of this.apiClient.streamChat(messages, this._abortController.signal)) {
        if (chunk.type === 'token' && chunk.content) {
          this.postMessage({ type: 'code_review_chunk', content: chunk.content })
        } else if (chunk.type === 'error') {
          this.postMessage({ type: 'code_review_end' })
          return
        } else if (chunk.type === 'done') {
          break
        }
      }
    } catch {
      // Ignore abort errors
    }
    this.postMessage({ type: 'code_review_end' })
  }

  private async _handleInlineEditRequest(instruction: string, code: string): Promise<void> {
    this.postMessage({ type: 'inline_edit_start' })

    this._abortController?.abort()
    this._abortController = new AbortController()

    const messages = [
      { role: 'user' as const, content: `请根据以下指令修改代码，只输出修改后的完整代码，不加解释：\n\n指令: ${instruction}\n\n原始代码：\n\`\`\`\n${code}\n\`\`\`` },
    ]

    try {
      for await (const chunk of this.apiClient.streamChat(messages, this._abortController.signal)) {
        if (chunk.type === 'token' && chunk.content) {
          this.postMessage({ type: 'inline_edit_chunk', content: chunk.content })
        } else if (chunk.type === 'error') {
          break
        } else if (chunk.type === 'done') {
          break
        }
      }
    } catch {
      // Ignore abort errors
    }
    this.postMessage({ type: 'inline_edit_end' })
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
