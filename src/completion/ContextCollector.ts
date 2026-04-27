import * as vscode from 'vscode'

const NEIGHBOUR_CHARS = 1200
const MAX_NEIGHBOURS = 3

/**
 * Cross-file context collector for Cursor-style next-edit prediction.
 *
 * Pulls:
 * - recently edited documents (most recent of `vscode.workspace.textDocuments`)
 * - open editor tab URIs (as light-weight hints)
 * - diagnostics from the current file (lets the model see linter errors)
 */
export class ContextCollector {
  collectNeighbours(active: vscode.TextDocument): Array<{ path: string; snippet: string }> {
    const activeUri = active.uri.toString()
    const docs = vscode.workspace.textDocuments
      .filter((d) =>
        d.uri.scheme === 'file' &&
        d.uri.toString() !== activeUri &&
        d.lineCount > 0 &&
        !d.isUntitled,
      )
      .slice(-MAX_NEIGHBOURS * 3)
      .reverse()

    const results: Array<{ path: string; snippet: string }> = []
    for (const doc of docs) {
      if (results.length >= MAX_NEIGHBOURS) break
      const text = doc.getText().slice(0, NEIGHBOUR_CHARS)
      if (!text.trim()) continue
      results.push({
        path: vscode.workspace.asRelativePath(doc.uri),
        snippet: text,
      })
    }
    return results
  }

  collectOpenTabs(exclude: vscode.Uri): string[] {
    const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs)
    const paths = new Set<string>()
    for (const tab of tabs) {
      const input = tab.input
      if (input && typeof input === 'object' && 'uri' in input) {
        const uri = (input as { uri: vscode.Uri }).uri
        if (uri.scheme !== 'file') continue
        if (uri.toString() === exclude.toString()) continue
        paths.add(vscode.workspace.asRelativePath(uri))
      }
    }
    return [...paths].slice(0, 8)
  }

  collectDiagnostics(uri: vscode.Uri): string[] {
    const diags = vscode.languages.getDiagnostics(uri)
    return diags
      .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
      .slice(0, 5)
      .map((d) => `[${d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warn'}] L${d.range.start.line + 1}: ${d.message}`)
  }
}
