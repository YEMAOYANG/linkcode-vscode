import * as vscode from 'vscode'
import type { ChatMessage, ExtensionToWebview, WebviewToExtension } from '../api/types'
import { streamChat } from '../api/client'
import { parseSSEStream } from '../api/stream'
import { getNonce } from '../utils/crypto'
import { Logger } from '../utils/logger'

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'linkcode.chatView'

  private _view?: vscode.WebviewView
  private _abortController?: AbortController
  private _chatHistory: ChatMessage[] = []
  private _getApiKey: () => Promise<string | undefined>

  constructor(
    private readonly extensionUri: vscode.Uri,
    getApiKey: () => Promise<string | undefined>
  ) {
    this._getApiKey = getApiKey
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

    // Handle messages from the WebView
    webviewView.webview.onDidReceiveMessage((msg: WebviewToExtension) => {
      switch (msg.type) {
        case 'sendMessage':
          this._handleSendMessage(msg.payload)
          break
        case 'ready':
          // WebView is ready
          break
      }
    })
  }

  /**
   * Send a typed message to the WebView
   */
  public postMessage(message: ExtensionToWebview): void {
    this._view?.webview.postMessage(message)
  }

  private async _handleSendMessage(text: string): Promise<void> {
    const logger = Logger.getInstance()

    // Add user message to history
    this._chatHistory.push({ role: 'user', content: text })

    // Cancel any in-flight stream
    this._abortController?.abort()
    this._abortController = new AbortController()

    try {
      const response = await streamChat(
        this._chatHistory,
        this._getApiKey,
        this._abortController.signal
      )

      let assistantContent = ''

      for await (const chunk of parseSSEStream(response, this._abortController.signal)) {
        if (chunk.type === 'token' && chunk.content) {
          assistantContent += chunk.content
          this.postMessage({ type: 'streamToken', payload: chunk.content })
        } else if (chunk.type === 'error') {
          this.postMessage({ type: 'streamError', error: chunk.error ?? 'Unknown error' })
          logger.error(`Stream error: ${chunk.error}`)
          return
        } else if (chunk.type === 'done') {
          break
        }
      }

      // Save assistant response to history
      this._chatHistory.push({ role: 'assistant', content: assistantContent })
      this.postMessage({ type: 'streamDone' })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      this.postMessage({ type: 'streamError', error: errorMessage })
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
