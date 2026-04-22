import * as vscode from 'vscode'

export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>()
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = []

    // Add CodeLens on function/class declarations
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i)
      const text = line.text

      // Match function/class/method declarations (basic heuristic)
      if (this._isFunctionOrClass(text)) {
        const range = new vscode.Range(i, 0, i, text.length)

        lenses.push(
          new vscode.CodeLens(range, {
            title: '$(sparkle) Explain',
            command: 'linkcode.explainCode',
            arguments: [document, range],
          }),
          new vscode.CodeLens(range, {
            title: '$(edit) Refactor',
            command: 'linkcode.refactorCode',
            arguments: [document, range],
          })
        )
      }
    }

    return lenses
  }

  private _isFunctionOrClass(text: string): boolean {
    const trimmed = text.trim()
    return (
      /^(export\s+)?(async\s+)?function\s+\w+/.test(trimmed) ||
      /^(export\s+)?(default\s+)?class\s+\w+/.test(trimmed) ||
      /^(public|private|protected)\s+(async\s+)?\w+\s*\(/.test(trimmed) ||
      /^(export\s+)?const\s+\w+\s*=\s*(async\s+)?\(/.test(trimmed)
    )
  }
}
