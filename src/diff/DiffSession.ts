import * as Diff from 'diff'
import * as vscode from 'vscode'

export interface DiffHunk {
  id: string
  /** 1-based original line numbers (inclusive). */
  originalStart: number
  originalEnd: number
  /** 1-based modified (applied) line numbers (inclusive). May be empty when only removals. */
  modifiedStart: number
  modifiedEnd: number
  addedLines: string[]
  removedLines: string[]
  status: 'pending' | 'accepted' | 'rejected'
}

/**
 * A single Apply operation — tracks original vs. new content, hunks, and per-hunk status.
 * After `applyToDocument` the file already equals `newContent`; rejecting hunks patches
 * individual regions back to the original lines.
 */
export class DiffSession {
  readonly id: string
  readonly uri: vscode.Uri
  readonly originalContent: string
  readonly newContent: string
  hunks: DiffHunk[]

  private constructor(uri: vscode.Uri, original: string, updated: string, hunks: DiffHunk[]) {
    this.id = `diff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    this.uri = uri
    this.originalContent = original
    this.newContent = updated
    this.hunks = hunks
  }

  static async create(uri: vscode.Uri, newContent: string): Promise<DiffSession> {
    const doc = await vscode.workspace.openTextDocument(uri)
    const original = doc.getText()
    const hunks = DiffSession.computeHunks(original, newContent)
    return new DiffSession(uri, original, newContent, hunks)
  }

  /**
   * Line-based diff via jsdiff, merged into contiguous hunks (added+removed runs
   * surrounded by equal blocks). Line numbers are 1-based, inclusive on both ends.
   */
  static computeHunks(original: string, updated: string): DiffHunk[] {
    const parts = Diff.diffLines(original, updated)
    const hunks: DiffHunk[] = []

    let origLine = 1
    let modLine = 1

    let cur: DiffHunk | null = null
    const finalize = (): void => {
      if (!cur) return
      // Fix inclusive ends when we did not add any modified or original lines
      if (cur.removedLines.length === 0) {
        cur.originalEnd = cur.originalStart - 1
      }
      if (cur.addedLines.length === 0) {
        cur.modifiedEnd = cur.modifiedStart - 1
      }
      hunks.push(cur)
      cur = null
    }

    for (const part of parts) {
      // jsdiff emits '\n' at end of the chunk; count raw lines
      const lines = part.value.split('\n')
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
      const count = lines.length

      if (!part.added && !part.removed) {
        finalize()
        origLine += count
        modLine += count
        continue
      }

      if (!cur) {
        cur = {
          id: `hunk-${hunks.length}-${Math.random().toString(36).slice(2, 6)}`,
          originalStart: origLine,
          originalEnd: origLine - 1, // inclusive; filled as we consume removed lines
          modifiedStart: modLine,
          modifiedEnd: modLine - 1,
          addedLines: [],
          removedLines: [],
          status: 'pending',
        }
      }

      if (part.added) {
        cur.addedLines.push(...lines)
        cur.modifiedEnd = modLine + count - 1
        modLine += count
      } else {
        cur.removedLines.push(...lines)
        cur.originalEnd = origLine + count - 1
        origLine += count
      }
    }
    finalize()
    return hunks
  }

  /**
   * Apply the new content to the document (full-file replace) and return the
   * edited editor instance. Must be called after constructing the session.
   */
  async applyToDocument(): Promise<vscode.TextEditor> {
    const editor = await vscode.window.showTextDocument(this.uri, { preview: false })
    const doc = editor.document
    if (doc.getText() === this.newContent) return editor
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length),
    )
    const edit = new vscode.WorkspaceEdit()
    edit.replace(this.uri, fullRange, this.newContent)
    const ok = await vscode.workspace.applyEdit(edit)
    if (!ok) {
      throw new Error(`WorkspaceEdit rejected for ${this.uri.fsPath}`)
    }
    return editor
  }

  pendingHunks(): DiffHunk[] {
    return this.hunks.filter((h) => h.status === 'pending')
  }

  findHunk(hunkId: string): DiffHunk | undefined {
    return this.hunks.find((h) => h.id === hunkId)
  }

  markAccepted(hunkId: string): boolean {
    const h = this.findHunk(hunkId)
    if (!h || h.status !== 'pending') return false
    h.status = 'accepted'
    return true
  }

  markRejected(hunkId: string): boolean {
    const h = this.findHunk(hunkId)
    if (!h || h.status !== 'pending') return false
    h.status = 'rejected'
    return true
  }

  allResolved(): boolean {
    return this.hunks.every((h) => h.status !== 'pending')
  }
}
