import * as vscode from 'vscode'
import type { ExtToWebMsg, WebToExtMsg } from '../shared/types'
import type { ChatMessage } from '../api/types'
import type { ApiClient } from '../api/client'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'linkcode.chatView'

  private _view?: vscode.WebviewView
  private _abortController?: AbortController
  private _chatHistory: ChatMessage[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiClient: ApiClient
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

    // Handle messages from the WebView
    webviewView.webview.onDidReceiveMessage((msg: WebToExtMsg) => {
      switch (msg.type) {
        case 'sendMessage':
          this._handleSendMessage(msg.text)
          break
        case 'ready':
          // WebView is ready
          break
      }
    })
  }

  /**
   * Send a typed message to the WebView.
   */
  public postMessage(message: ExtToWebMsg): void {
    this._view?.webview.postMessage(message)
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
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
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
