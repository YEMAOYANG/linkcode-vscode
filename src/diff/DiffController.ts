import * as vscode from 'vscode'
import { Logger } from '../utils/logger'
import { DiffDecorationManager } from './DiffDecorationManager'
import { DiffHunkCodeLensProvider } from './DiffHunkCodeLensProvider'
import { DiffSession } from './DiffSession'

const CONTEXT_HAS_ACTIVE_DIFF = 'linkcode.hasActiveDiff'

/**
 * Orchestrates Cursor-style inline diff sessions.
 * - Maintains a map of active sessions keyed by document URI.
 * - Bridges hunk commands (accept/reject + accept-all/reject-all) to session state.
 * - Updates decorations + CodeLens refresh when state changes.
 */
export class DiffController implements vscode.Disposable {
  private readonly sessions = new Map<string, DiffSession>()
  private readonly decorationMgr = new DiffDecorationManager()
  private readonly codeLensProvider: DiffHunkCodeLensProvider
  private readonly codeLensDisposable: vscode.Disposable
  private readonly postMessage?: (msg: unknown) => void

  constructor(postMessage?: (msg: unknown) => void) {
    this.postMessage = postMessage
    this.codeLensProvider = new DiffHunkCodeLensProvider(() => [...this.sessions.values()])
    this.codeLensDisposable = vscode.languages.registerCodeLensProvider(
      { scheme: 'file' },
      this.codeLensProvider,
    )
    this.refreshContext()
  }

  /** Start a new inline diff session on `uri` with `newContent`. */
  async startSession(uri: vscode.Uri, newContent: string): Promise<DiffSession> {
    // Close an existing session on the same document first
    const existing = this.sessions.get(uri.toString())
    if (existing) {
      await this.rejectAll(existing.id)
    }

    const session = await DiffSession.create(uri, newContent)
    if (session.hunks.length === 0) {
      Logger.getInstance().info('[DiffController] no diff; skipping session')
      await session.applyToDocument()
      return session
    }

    const editor = await session.applyToDocument()
    this.sessions.set(uri.toString(), session)
    this.decorationMgr.update(editor, session.hunks)
    this.codeLensProvider.refresh()
    this.refreshContext()

    this.postMessage?.({
      type: 'applyEditStarted',
      sessionId: session.id,
      filepath: uri.fsPath,
      hunks: session.hunks.length,
    })

    // Reveal first pending hunk
    const firstPending = session.pendingHunks()[0]
    if (firstPending) {
      const line = Math.max(0, firstPending.modifiedStart - 1)
      editor.revealRange(new vscode.Range(line, 0, line, 0), vscode.TextEditorRevealType.InCenter)
    }
    return session
  }

  getSessionById(id: string): DiffSession | undefined {
    for (const s of this.sessions.values()) {
      if (s.id === id) return s
    }
    return undefined
  }

  /**
   * Resolve the active session id for the focused editor (used by keybinding
   * invocations that arrive without arguments).
   */
  resolveActiveSessionId(): string | undefined {
    const active = vscode.window.activeTextEditor
    if (active) {
      const s = this.sessions.get(active.document.uri.toString())
      if (s) return s.id
    }
    // Fallback: most recently inserted session
    return [...this.sessions.values()].pop()?.id
  }

  async acceptHunk(sessionId: string, hunkId: string): Promise<void> {
    const session = this.getSessionById(sessionId)
    if (!session) return
    if (!session.markAccepted(hunkId)) return
    await this.rerender(session)
    await this.maybeFinish(session, 'accepted')
  }

  async rejectHunk(sessionId: string, hunkId: string): Promise<void> {
    const session = this.getSessionById(sessionId)
    if (!session) return
    const hunk = session.findHunk(hunkId)
    if (!hunk || hunk.status !== 'pending') return

    // Replace the hunk's modified region with the original removed lines
    const editor = await vscode.window.showTextDocument(session.uri, { preview: false })
    const doc = editor.document
    const modifiedLineCount = Math.max(0, hunk.modifiedEnd - hunk.modifiedStart + 1)
    const hasAdded = hunk.addedLines.length > 0

    // Determine the range to replace
    let startPos: vscode.Position
    let endPos: vscode.Position
    if (hasAdded) {
      startPos = new vscode.Position(hunk.modifiedStart - 1, 0)
      // End = first char of the line after modifiedEnd (so we delete whole lines)
      const endLineIndex = hunk.modifiedStart - 1 + modifiedLineCount
      endPos = endLineIndex <= doc.lineCount
        ? new vscode.Position(endLineIndex, 0)
        : new vscode.Position(doc.lineCount, 0)
    } else {
      // Pure deletion — no added lines to remove; we need to *re-insert* removedLines
      const anchorLine = Math.max(0, hunk.modifiedStart - 1)
      startPos = new vscode.Position(anchorLine, 0)
      endPos = startPos
    }

    const replacement = hunk.removedLines.length > 0
      ? hunk.removedLines.join('\n') + '\n'
      : ''

    const edit = new vscode.WorkspaceEdit()
    edit.replace(session.uri, new vscode.Range(startPos, endPos), replacement)
    const ok = await vscode.workspace.applyEdit(edit)
    if (!ok) {
      Logger.getInstance().warn(`[DiffController] rejectHunk failed to apply ${hunk.id}`)
      return
    }

    // Update line offsets for the remaining pending hunks
    const deltaLines = hunk.removedLines.length - modifiedLineCount
    for (const h of session.hunks) {
      if (h === hunk) continue
      if (h.status !== 'pending') continue
      if (h.modifiedStart > hunk.modifiedEnd) {
        h.modifiedStart += deltaLines
        h.modifiedEnd += deltaLines
      }
    }

    session.markRejected(hunkId)
    await this.rerender(session)
    await this.maybeFinish(session, 'rejected')
  }

  async acceptAll(sessionId: string): Promise<void> {
    const session = this.getSessionById(sessionId)
    if (!session) return
    for (const h of session.hunks) {
      if (h.status === 'pending') h.status = 'accepted'
    }
    await this.finish(session, 'accepted')
  }

  async rejectAll(sessionId: string): Promise<void> {
    const session = this.getSessionById(sessionId)
    if (!session) return
    // Restore the full original content
    const editor = await vscode.window.showTextDocument(session.uri, { preview: false })
    const doc = editor.document
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length),
    )
    const edit = new vscode.WorkspaceEdit()
    edit.replace(session.uri, fullRange, session.originalContent)
    await vscode.workspace.applyEdit(edit)
    for (const h of session.hunks) {
      if (h.status === 'pending') h.status = 'rejected'
    }
    await this.finish(session, 'rejected')
  }

  private async rerender(session: DiffSession): Promise<void> {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === session.uri.toString(),
    )
    if (editor) this.decorationMgr.update(editor, session.hunks)
    this.codeLensProvider.refresh()
  }

  private async maybeFinish(session: DiffSession, status: 'accepted' | 'rejected'): Promise<void> {
    if (session.allResolved()) {
      await this.finish(session, status)
    }
  }

  private async finish(
    session: DiffSession,
    status: 'accepted' | 'rejected' | 'cancelled',
  ): Promise<void> {
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === session.uri.toString(),
    )
    this.decorationMgr.clear(editor)
    this.sessions.delete(session.uri.toString())
    this.codeLensProvider.refresh()
    this.refreshContext()
    this.postMessage?.({
      type: 'applyEditDone',
      sessionId: session.id,
      status,
    })
  }

  private refreshContext(): void {
    void vscode.commands.executeCommand('setContext', CONTEXT_HAS_ACTIVE_DIFF, this.sessions.size > 0)
  }

  /** Called by extension.ts on deactivation. */
  dispose(): void {
    this.decorationMgr.dispose()
    this.codeLensDisposable.dispose()
    this.sessions.clear()
    this.refreshContext()
  }

  /** Used by CodeLens provider to look up sessions by document. */
  getSessionForDocument(doc: vscode.TextDocument): DiffSession | undefined {
    return this.sessions.get(doc.uri.toString())
  }
}
