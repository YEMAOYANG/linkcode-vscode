import * as vscode from 'vscode'

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'linkcode.chatView'

  private _view?: vscode.WebviewView

  constructor(private readonly extensionUri: vscode.Uri) {}

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
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      switch (msg.type) {
        case 'sendMessage':
          this._handleSendMessage(msg.payload as string)
          break
        case 'ready':
          // WebView is ready
          break
      }
    })
  }

  /**
   * Send a message to the WebView
   */
  public postMessage(message: Record<string, unknown>): void {
    this._view?.webview.postMessage(message)
  }

  private _handleSendMessage(text: string): void {
    // TODO: Call streaming API and push tokens to WebView
    this.postMessage({
      type: 'assistantMessage',
      payload: `Echo: ${text}`,
    })
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

interface WebviewMessage {
  type: string
  payload?: unknown
}

function getNonce(): string {
  let text = ''
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
