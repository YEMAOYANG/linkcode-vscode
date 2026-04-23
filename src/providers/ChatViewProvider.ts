import * as vscode from 'vscode'
import type { ExtToWebMsg, WebToExtMsg, StoredChatMessage } from '../shared/types'
import type { ChatMessage } from '../api/types'
import type { ApiClient } from '../api/client'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'
import { CONFIG_SECTION, DEFAULT_MODEL } from '../shared/constants'

const HISTORY_KEY = 'linkcode.chatHistory'

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
          // WebView is ready — send current model info
          this._sendModelInfo()
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
  public handleUserAction(action: string, payload: string): void {
    // Notify webview to display the user action
    this.postMessage({
      type: 'user_action',
      action: action as 'explain' | 'refactor' | 'review',
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
    config.update('model', modelId, vscode.ConfigurationTarget.Global)
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
    vscode.workspace.applyEdit(edit)
  }

  /** Load persisted messages and send to webview */
  private _sendHistory(): void {
    const stored = this.globalState.get<StoredChatMessage[]>(HISTORY_KEY, [])
    this._view?.webview.postMessage({
      type: 'loadHistory',
      messages: stored,
    })
  }

  /** Save messages from webview to globalState */
  private _saveHistory(messages: StoredChatMessage[]): void {
    this.globalState.update(HISTORY_KEY, messages)
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
          break
        }
      }

      // Save assistant response to history
      this._chatHistory.push({ role: 'assistant', content: assistantContent })
      this.postMessage({ type: 'stream_end' })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.postMessage({ type: 'stream_error', message: errorMessage })
      logger.error('Chat stream failed', err)
    }
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
