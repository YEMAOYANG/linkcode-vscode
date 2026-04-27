import * as path from 'node:path'
import * as vscode from 'vscode'
import type { ExtToWebMsg, WebToExtMsg, StoredChatMessage, ApiModelInfo, SessionSummary, PricingResponse, AtSearchItem, ChatMode } from '../shared/types'
import type { ChatMessage } from '../api/types'
import type { ApiClient } from '../api/client'
import type { SecretStore } from '../utils/secretStorage'
import type { DiffController } from '../diff/DiffController'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'
import { AuthError, ApiError } from '../shared/errors'
import { CONFIG_SECTION, DEFAULT_MODEL, DEFAULT_API_ENDPOINT, MODEL_TO_GROUP, TOKEN_GROUPS, inferTokenGroup } from '../shared/constants'
import { SYSTEM_PROMPTS, buildFromPlanPrompt } from '../shared/prompts'

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
  private _diffController?: DiffController

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiClient: ApiClient,
    private readonly globalState: vscode.Memento
  ) {}

  /** Inject SecretStore for group token management */
  public setSecretStore(store: SecretStore): void {
    this._secretStore = store
  }

  /** Phase 5B: inject DiffController for Cursor-style inline diff */
  public setDiffController(controller: DiffController): void {
    this._diffController = controller
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
          void this._handleSendMessage(msg.text, msg.mode ?? 'ask')
          break
        case 'buildFromPlan': {
          const bfpMsg = msg as { type: 'buildFromPlan'; planContent: string; modelId?: string }
          void this._handleBuildFromPlan(bfpMsg.planContent, bfpMsg.modelId)
          break
        }
        case 'ready':
          this._sendModelInfo()
          this._fetchModels()
          this._fetchPricing()
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
        case 'applyEdit': {
          const aeMsg = msg as {
            type: 'applyEdit'
            code: string
            filename?: string
            language?: string
            lineRange?: string
          }
          void this._handleApplyEdit(aeMsg.code, aeMsg.filename, aeMsg.language, aeMsg.lineRange)
          break
        }
        case 'applyEditAcceptAll': {
          const m = msg as { type: 'applyEditAcceptAll'; sessionId: string }
          void this._diffController?.acceptAll(m.sessionId)
          break
        }
        case 'applyEditRejectAll': {
          const m = msg as { type: 'applyEditRejectAll'; sessionId: string }
          void this._diffController?.rejectAll(m.sessionId)
          break
        }
        case 'applyEditAcceptHunk': {
          const m = msg as { type: 'applyEditAcceptHunk'; sessionId: string; hunkId: string }
          void this._diffController?.acceptHunk(m.sessionId, m.hunkId)
          break
        }
        case 'applyEditRejectHunk': {
          const m = msg as { type: 'applyEditRejectHunk'; sessionId: string; hunkId: string }
          void this._diffController?.rejectHunk(m.sessionId, m.hunkId)
          break
        }
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
        case 'attachImage': {
          const imgMsg = msg as { type: 'attachImage'; name: string; base64: string }
          this._attachedFiles.push({
            name: imgMsg.name,
            content: `[图片: ${imgMsg.name}]`,
          })
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
          void this._handleApplyEdit(acceptMsg.code)
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
        // Phase 3B: Cursor-style @ mention search
        case 'atSearch': {
          const asMsg = msg as {
            type: 'atSearch'
            requestId: string
            kind: 'files' | 'folders' | 'code' | 'codebase' | 'docs' | 'pastChats'
            query: string
          }
          void this._handleAtSearch(asMsg.requestId, asMsg.kind, asMsg.query)
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
    void this._handleSendMessage(prompt, 'ask')
  }

  public quoteCodeToChat(
    code: string,
    language: string,
    meta?: { filename?: string; filepath?: string; lineStart?: number; lineEnd?: number },
  ): void {
    this.postMessage({
      type: 'quote_code',
      code,
      language,
      filename: meta?.filename,
      filepath: meta?.filepath,
      lineStart: meta?.lineStart,
      lineEnd: meta?.lineEnd,
    })
  }

  public sendInlineEditContext(code: string, _language: string, filepath: string): void {
    this.postMessage({ type: 'show_inline_edit' })
    this.postMessage({ type: 'inline_edit_context', code, fileName: filepath })
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
      // Phase 2.4: gather ALL configured tokens (apiTokens config + SecretStorage groups)
      const apiKeys = new Set<string>()
      const configTokens = config.get<Record<string, string>>('apiTokens') ?? {}
      for (const v of Object.values(configTokens)) {
        if (v && v.trim()) apiKeys.add(v.trim())
      }
      if (this._secretStore) {
        const configuredGroups = await this._secretStore.getConfiguredGroups()
        for (const group of configuredGroups) {
          const token = await this._secretStore.getGroupToken(group)
          if (token && token.trim()) apiKeys.add(token.trim())
        }
      }
      if (apiKeys.size === 0) {
        const legacyKey = await this._getApiKeyForModels()
        if (legacyKey) apiKeys.add(legacyKey)
      }

      if (apiKeys.size === 0) {
        logger.info('[fetchModels] No API key configured, sending empty model list')
        this.postMessage({ type: 'modelList', models: [] })
        return
      }

      const fetchOne = async (apiKey: string): Promise<string[]> => {
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
            logger.warn(`[fetchModels] API returned ${res.status} for one token`)
            return []
          }
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          return data.data?.map(m => m.id) ?? []
        } finally {
          clearTimeout(timeout)
        }
      }

      const results = await Promise.allSettled([...apiKeys].map(fetchOne))
      const allIds = new Set<string>()
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const id of r.value) allIds.add(id)
        } else {
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          logger.warn(`[fetchModels] One token fetch failed: ${reason}`)
        }
      }

      if (allIds.size === 0) {
        logger.warn('[fetchModels] All tokens returned empty, sending empty model list')
        this.postMessage({ type: 'modelList', models: [] })
        return
      }

      const models: ApiModelInfo[] = [...allIds].map((id) => ({
        id,
        label: id,
        provider: ChatViewProvider._inferProvider(id),
      }))

      logger.info(`[fetchModels] Aggregated ${models.length} models from ${apiKeys.size} token(s)`)
      this.postMessage({ type: 'modelList', models })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('[fetchModels] Request timed out, sending empty list')
      } else {
        logger.error('[fetchModels] Failed to fetch models', err)
      }
      this.postMessage({ type: 'modelList', models: [] })
    }
  }

  /** Fetch pricing data from Smoothlink public API and forward to WebView */
  private async _fetchPricing(): Promise<void> {
    const logger = Logger.getInstance()
    try {
      const res = await fetch('https://smoothlink.ai/api/pricing', {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        logger.warn(`[fetchPricing] API returned ${res.status}`)
        return
      }
      const json = (await res.json()) as PricingResponse
      if (!json.data?.length) return

      logger.info(`[fetchPricing] Got ${json.data.length} pricing items`)
      this.postMessage({
        type: 'pricingData',
        models: json.data,
        groupRatio: json.group_ratio ?? {},
      })
    } catch {
      // Silent failure — WebView uses no pricing info as fallback
      logger.warn('[fetchPricing] Request failed, pricing data unavailable')
    }
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

  /**
   * Phase 5A/5B: Apply code to the editor as a Cursor-style inline diff session.
   * Falls back to direct WorkspaceEdit when no target file can be resolved.
   *
   * When `lineRange` is provided (e.g. "19-25"), the incoming `code` is a partial
   * snippet. We merge it into the original file content before passing the full
   * result to DiffController so the diff is correct.
   */
  private async _handleApplyEdit(
    code: string,
    filename?: string,
    _language?: string,
    lineRange?: string,
  ): Promise<void> {
    const logger = Logger.getInstance()
    let targetUri: vscode.Uri | undefined

    if (filename) {
      const matches = await vscode.workspace.findFiles(`**/${filename}`, '**/node_modules/**', 5)
      if (matches.length) targetUri = matches[0]
    }
    if (!targetUri) {
      targetUri = vscode.window.activeTextEditor?.document.uri
    }
    if (!targetUri) {
      vscode.window.showWarningMessage('LinkCode: 未找到应用目标，请先打开目标文件或让 AI 附上 filename')
      return
    }

    let fullNewContent = code

    // When the AI returns a partial snippet with a line range, merge it into
    // the original file so DiffController receives the complete new file.
    if (lineRange) {
      const rangeMatch = /^(\d+)(?:-(\d+))?$/.exec(lineRange)
      if (rangeMatch) {
        try {
          const doc = await vscode.workspace.openTextDocument(targetUri)
          const originalLines = doc.getText().split('\n')
          const startLine = Math.max(1, parseInt(rangeMatch[1], 10))
          const endLine = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : startLine
          const clampedEnd = Math.min(endLine, originalLines.length)

          const snippetLines = code.split('\n')
          const before = originalLines.slice(0, startLine - 1)
          const after = originalLines.slice(clampedEnd)
          fullNewContent = [...before, ...snippetLines, ...after].join('\n')
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          logger.warn(`[applyEdit] Failed to merge line range, using raw code: ${errMsg}`)
        }
      }
    }

    if (this._diffController) {
      try {
        await this._diffController.startSession(targetUri, fullNewContent)
        return
      } catch (err) {
        logger.error('[applyEdit] DiffController failed, falling back to WorkspaceEdit', err)
      }
    }

    // Legacy fallback: replace whole file
    const editor = vscode.window.activeTextEditor
    if (!editor || editor.document.uri.toString() !== targetUri.toString()) {
      await vscode.window.showTextDocument(targetUri)
    }
    const active = vscode.window.activeTextEditor
    if (!active) return
    const doc = active.document
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length),
    )
    const edit = new vscode.WorkspaceEdit()
    edit.replace(targetUri, fullRange, fullNewContent)
    const ok = await vscode.workspace.applyEdit(edit)
    if (!ok) {
      logger.warn('[applyEdit] WorkspaceEdit was rejected by VS Code')
      vscode.window.showWarningMessage('LinkCode: 代码应用失败，请检查文件是否只读')
    }
  }

  /**
   * Agent mode: scan streamed content for Cursor-style fences and apply them
   * serially through DiffController so the user sees inline diffs for each.
   *
   * Recognised fence variants:
   *   ```lang:filename:start-end
   *   ```lang:filename
   * A trailing `filename` without extension or a pure `lang` fence is ignored
   * (treated as plain illustrative code).
   */
  private async _autoApplyAgentBlocks(content: string): Promise<void> {
    const logger = Logger.getInstance()
    const fenceRe = /```([a-zA-Z0-9+_-]+)((?::[^\n`]+)?)\n([\s\S]*?)```/g
    const blocks: Array<{ code: string; language: string; filename?: string; lineRange?: string }> = []

    let match: RegExpExecArray | null
    while ((match = fenceRe.exec(content)) !== null) {
      const language = match[1]
      const rawMeta = match[2] // e.g. ":filename.ts:12-20" or ":filename.ts" or ""
      const code = match[3]
      const metaParts = rawMeta.startsWith(':') ? rawMeta.slice(1).split(':') : []
      let filename: string | undefined
      let lineRange: string | undefined
      for (const part of metaParts) {
        if (!part) continue
        if (/^\d+(?:-\d+)?$/.test(part)) {
          lineRange = part
        } else {
          filename = part
        }
      }
      if (!filename) continue // Plain ```lang code — not an applicable block
      blocks.push({ code, language, filename, lineRange })
    }

    if (blocks.length === 0) {
      logger.info('[autoApplyAgent] No applicable fences found in response')
      return
    }

    logger.info(`[autoApplyAgent] Applying ${blocks.length} block(s) serially`)
    for (const b of blocks) {
      try {
        await this._handleApplyEdit(b.code, b.filename, b.language, b.lineRange)
      } catch (err) {
        logger.error(`[autoApplyAgent] Failed to apply block for ${b.filename}`, err)
      }
    }
  }

  /**
   * Plan → Build: switch to the requested model (if any), then resend the plan
   * content as an Agent-mode prompt to trigger code execution.
   */
  private async _handleBuildFromPlan(planContent: string, modelId?: string): Promise<void> {
    if (modelId) {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
      await Promise.resolve(config.update('model', modelId, vscode.ConfigurationTarget.Global))
    }
    const prompt = buildFromPlanPrompt(planContent)
    await this._handleSendMessage(prompt, 'agent')
  }

  private _sendHistory(): void {
    const stored = this.globalState.get<StoredChatMessage[]>(HISTORY_KEY, [])
    this._view?.webview.postMessage({ type: 'loadHistory', messages: stored })
    this._chatHistory = stored.map((m) => ({ role: m.role, content: m.content }))
  }

  private _saveHistory(messages: StoredChatMessage[]): void {
    void Promise.resolve(this.globalState.update(HISTORY_KEY, messages))
  }

  /**
   * Send a user message to the AI.
   * `mode` controls which system prompt is injected and whether code fences
   * are auto-applied to the editor when the stream ends.
   */
  private async _handleSendMessage(text: string, mode: ChatMode = 'ask'): Promise<void> {
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

      // Cursor-style: prepend a mode-specific system prompt, then the full chat history.
      const messagesForApi: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS[mode] },
        ...this._chatHistory,
      ]

      for await (const chunk of this.apiClient.streamChat(
        messagesForApi,
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

      if (mode === 'agent' && assistantContent.trim()) {
        await this._autoApplyAgentBlocks(assistantContent)
      }
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
      // Only check group tokens — general API key may be auto-seeded default
      if (this._secretStore) {
        const groups = TOKEN_GROUPS.map(g => g.id)
        const status = await this._secretStore.getGroupTokenStatus(groups)
        const hasGroupToken = Object.values(status).some(Boolean)
        if (!hasGroupToken) {
          this.postMessage({ type: 'show_onboarding' })
        }
      } else {
        this.postMessage({ type: 'show_onboarding' })
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
          // Phase 2: merge newly-unlocked models into webview's model list.
          // 对 _detect (onboarding 快速验证) 模式,推断真实分组后同样合并,
          // 避免前端默认模型列表与已解锁分组脱节导致选到错误模型。
          if (modelIds.length > 0) {
            const effectiveGroup = group === '_detect' ? inferTokenGroup(modelIds) : group
            if (effectiveGroup && effectiveGroup !== 'unknown') {
              const mergedModels: ApiModelInfo[] = modelIds.map((id) => ({
                id,
                label: id,
                provider: ChatViewProvider._inferProvider(id),
              }))
              this.postMessage({ type: 'modelListMerge', group: effectiveGroup, models: mergedModels })
            }
          }
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
    await this._handleGetGroupTokenStatus()
    // Immediately clear the model list so the UI reacts before the async re-fetch completes
    this.postMessage({ type: 'modelList', models: [] })
    void this._fetchModels()
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
          files.push({ name: path.basename(uri.fsPath), path: uri.fsPath })
        }
      }
    }

    this.postMessage({ type: 'recentFiles', files: files.slice(0, 20) })
  }

  /** Task 3: Read file content and send to webview. Supports file:// URI, absolute path, or workspace-relative path. */
  private async _handleGetFileContent(filepath: string): Promise<void> {
    try {
      let uri: vscode.Uri
      if (filepath.startsWith('file://')) {
        uri = vscode.Uri.parse(filepath)
      } else if (path.isAbsolute(filepath)) {
        uri = vscode.Uri.file(filepath)
      } else {
        // Detector+Finder: resolve basename inside the workspace
        const matches = await vscode.workspace.findFiles(`**/${filepath}`, '**/node_modules/**', 5)
        if (!matches.length) {
          Logger.getInstance().warn(`[getFileContent] Not found: ${filepath}`)
          return
        }
        uri = matches[0]
      }
      const content = await vscode.workspace.fs.readFile(uri)
      const text = new TextDecoder().decode(content)
      this.postMessage({
        type: 'fileContent',
        filepath: uri.fsPath,
        content: text,
        name: path.basename(uri.fsPath),
      })
    } catch (err: unknown) {
      Logger.getInstance().error(`[getFileContent] Failed to read ${filepath}`, err)
    }
  }

  /**
   * Phase 3B: Cursor 2.0 @ mention dispatch.
   * Supports: files / folders / code / codebase / docs / pastChats.
   */
  private async _handleAtSearch(
    requestId: string,
    kind: 'files' | 'folders' | 'code' | 'codebase' | 'docs' | 'pastChats',
    query: string,
  ): Promise<void> {
    const send = (items: AtSearchItem[]): void => {
      this.postMessage({ type: 'atSearchResult', requestId, kind, items })
    }

    try {
      switch (kind) {
        case 'files': {
          const pattern = query.trim() ? `**/*${query.trim()}*` : '**/*'
          const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 50)
          const items: AtSearchItem[] = uris.map((uri) => ({
            kind: 'files',
            label: path.basename(uri.fsPath),
            detail: vscode.workspace.asRelativePath(uri),
            value: vscode.workspace.asRelativePath(uri),
            filepath: uri.fsPath,
          }))
          send(items)
          break
        }
        case 'folders': {
          const folders = await this._collectFolders(query.trim().toLowerCase())
          send(folders)
          break
        }
        case 'code': {
          const symbols = (await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            'vscode.executeWorkspaceSymbolProvider',
            query,
          )) ?? []
          const items: AtSearchItem[] = symbols.slice(0, 50).map((s) => {
            const uri = s.location.uri
            const range = s.location.range
            return {
              kind: 'code',
              label: s.name,
              detail: `${s.containerName ? s.containerName + ' · ' : ''}${vscode.workspace.asRelativePath(uri)}`,
              value: s.name,
              filepath: uri.fsPath,
              lineStart: range.start.line + 1,
              lineEnd: range.end.line + 1,
            }
          })
          send(items)
          break
        }
        case 'codebase': {
          // v1 placeholder: echo query back; real implementation needs ripgrep integration
          send([
            {
              kind: 'codebase',
              label: query || '@Codebase',
              detail: '整个代码库语义检索（发送时注入 top-K 片段，v1 占位）',
              value: `@Codebase${query ? ':' + query : ''}`,
            },
          ])
          break
        }
        case 'pastChats': {
          const sessions = this.globalState.get<SessionSummary[]>(SESSION_LIST_KEY, [])
          const items: AtSearchItem[] = sessions
            .filter((s) => !query.trim() || s.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 20)
            .map((s) => ({
              kind: 'pastChats',
              label: s.title || 'Untitled chat',
              detail: `${s.messageCount} messages · ${new Date(s.timestamp).toLocaleDateString()}`,
              value: `chat:${s.id}`,
              sessionId: s.id,
            }))
          send(items)
          break
        }
        case 'docs': {
          // v1 placeholder — Coming soon
          send([])
          break
        }
      }
    } catch (err: unknown) {
      Logger.getInstance().error(`[atSearch] ${kind} failed`, err)
      send([])
    }
  }

  /** Collect folders from workspace root (top 3 levels) filtered by query. */
  private async _collectFolders(query: string): Promise<AtSearchItem[]> {
    const roots = vscode.workspace.workspaceFolders ?? []
    const items: AtSearchItem[] = []
    const MAX_DEPTH = 3
    const MAX_RESULTS = 50
    const EXCLUDE = new Set(['node_modules', '.git', 'dist', 'out', '.next', '.nuxt', '.cache', 'coverage'])

    const walk = async (uri: vscode.Uri, depth: number): Promise<void> => {
      if (items.length >= MAX_RESULTS || depth > MAX_DEPTH) return
      let children: [string, vscode.FileType][]
      try {
        children = await vscode.workspace.fs.readDirectory(uri)
      } catch {
        return
      }
      for (const [name, type] of children) {
        if (items.length >= MAX_RESULTS) return
        if (type !== vscode.FileType.Directory) continue
        if (EXCLUDE.has(name) || name.startsWith('.')) continue
        const childUri = vscode.Uri.joinPath(uri, name)
        const rel = vscode.workspace.asRelativePath(childUri)
        if (!query || rel.toLowerCase().includes(query)) {
          items.push({
            kind: 'folders',
            label: name,
            detail: rel,
            value: rel,
            filepath: childUri.fsPath,
          })
        }
        await walk(childUri, depth + 1)
      }
    }

    for (const root of roots) {
      await walk(root.uri, 0)
    }
    return items
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
