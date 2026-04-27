import * as vscode from 'vscode'
import type { DiffSession } from './DiffSession'

/**
 * Renders CodeLens buttons above each pending hunk:
 * - Session banner above the first pending hunk showing the change count +
 *   Accept All / Reject All shortcuts.
 * - Per-hunk Accept / Reject actions on the modified line.
 *
 * Anchoring the banner to the first pending hunk (rather than line 0) keeps
 * the Apply controls close to the actual diff — matching Cursor's behaviour.
 */
export class DiffHunkCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>()
  onDidChangeCodeLenses = this._onDidChangeCodeLenses.event

  constructor(private readonly getSessions: () => DiffSession[]) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const sessions = this.getSessions().filter(
      (s) => s.uri.toString() === document.uri.toString(),
    )
    if (sessions.length === 0) return []

    const lenses: vscode.CodeLens[] = []
    for (const session of sessions) {
      const pending = session.pendingHunks()
      if (pending.length === 0) continue

      const firstLine = Math.max(0, pending[0].modifiedStart - 1)
      const bannerRange = new vscode.Range(firstLine, 0, firstLine, 0)
      const plural = pending.length > 1 ? 's' : ''
      lenses.push(
        new vscode.CodeLens(bannerRange, {
          title: `$(sparkle) LinkCode · ${pending.length} pending change${plural}`,
          command: '',
        }),
        new vscode.CodeLens(bannerRange, {
          title: '$(check-all) Accept All',
          tooltip: '接受所有改动 (Ctrl/Cmd + Shift + Enter)',
          command: 'linkcode.acceptAllHunks',
          arguments: [session.id],
        }),
        new vscode.CodeLens(bannerRange, {
          title: '$(discard) Reject All',
          tooltip: '丢弃所有改动 (Esc)',
          command: 'linkcode.rejectAllHunks',
          arguments: [session.id],
        }),
      )

      for (const hunk of pending) {
        const line = Math.max(0, hunk.modifiedStart - 1)
        const range = new vscode.Range(line, 0, line, 0)
        lenses.push(
          new vscode.CodeLens(range, {
            title: '$(check) Accept',
            tooltip: `接受此处改动 (${hunk.addedLines.length}+ / ${hunk.removedLines.length}-)`,
            command: 'linkcode.acceptHunk',
            arguments: [session.id, hunk.id],
          }),
          new vscode.CodeLens(range, {
            title: '$(close) Reject',
            tooltip: '丢弃此处改动',
            command: 'linkcode.rejectHunk',
            arguments: [session.id, hunk.id],
          }),
        )
      }
    }
    return lenses
  }

  refresh(): void {
    this._onDidChangeCodeLenses.fire()
  }
}
