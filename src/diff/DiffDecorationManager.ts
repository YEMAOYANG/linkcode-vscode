import * as vscode from 'vscode'
import type { DiffHunk } from './DiffSession'

/**
 * Cursor-style inline diff decorations.
 *
 * Design notes:
 * - Added lines get a soft green full-width background and a thin left accent bar.
 * - Removed lines are rendered as virtual strikethrough ghost lines ABOVE the
 *   first modified line. VSCode can only stack multiple virtual `before`
 *   contents on a single range by using DIFFERENT decoration types, so we
 *   maintain a pool of per-slot decoration types and reuse them across hunks.
 * - All colors are derived from VSCode theme colors so the diff blends into
 *   both light and dark themes (matches the gutter diff style natively).
 */
const MAX_REMOVED_PREVIEW_CHARS = 200

export class DiffDecorationManager implements vscode.Disposable {
  private readonly addedLineDecoration: vscode.TextEditorDecorationType
  private readonly addedGutterDecoration: vscode.TextEditorDecorationType
  /** Pool of decoration types — one slot per removed-line index (reused). */
  private readonly removedSlotPool: vscode.TextEditorDecorationType[] = []

  constructor() {
    this.addedLineDecoration = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
      overviewRulerLane: vscode.OverviewRulerLane.Full,
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: new vscode.ThemeColor('diffEditor.insertedTextBorder'),
    })

    this.addedGutterDecoration = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: '+',
        color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
        margin: '0 6px 0 -16px',
        width: '10px',
      },
    })
  }

  /** Apply decorations for the pending hunks. */
  update(editor: vscode.TextEditor, hunks: DiffHunk[]): void {
    const addedRanges: vscode.Range[] = []
    // Map slot index → list of ranges (each slot is a distinct decoration type)
    const slotBuckets = new Map<number, Array<{ range: vscode.Range; contentText: string }>>()

    for (const hunk of hunks) {
      if (hunk.status !== 'pending') continue

      // Added: one whole-line highlight per modified line
      if (hunk.addedLines.length > 0) {
        for (let line = hunk.modifiedStart - 1; line <= hunk.modifiedEnd - 1; line++) {
          if (line < 0 || line >= editor.document.lineCount) continue
          addedRanges.push(new vscode.Range(line, 0, line, 0))
        }
      }

      // Removed: each line gets its own slot so they stack as separate virtual lines
      if (hunk.removedLines.length > 0) {
        const anchorLine = Math.max(0, hunk.modifiedStart - 1)
        const range = new vscode.Range(anchorLine, 0, anchorLine, 0)
        hunk.removedLines.forEach((removed, slotIdx) => {
          const bucket = slotBuckets.get(slotIdx) ?? []
          bucket.push({ range, contentText: this._formatRemovedLine(removed) })
          slotBuckets.set(slotIdx, bucket)
        })
      }
    }

    editor.setDecorations(this.addedLineDecoration, addedRanges)
    editor.setDecorations(this.addedGutterDecoration, addedRanges)

    // Clear any unused slot pool entries and set each used slot
    const neededSlots = slotBuckets.size
    this._ensurePool(neededSlots)
    for (let i = 0; i < this.removedSlotPool.length; i++) {
      const slot = this.removedSlotPool[i]
      const bucket = slotBuckets.get(i)
      if (!bucket) {
        editor.setDecorations(slot, [])
        continue
      }
      editor.setDecorations(
        slot,
        bucket.map(({ range, contentText }) => ({
          range,
          renderOptions: { before: { contentText } },
        })),
      )
    }
  }

  clear(editor: vscode.TextEditor | undefined): void {
    if (!editor) return
    editor.setDecorations(this.addedLineDecoration, [])
    editor.setDecorations(this.addedGutterDecoration, [])
    for (const slot of this.removedSlotPool) {
      editor.setDecorations(slot, [])
    }
  }

  dispose(): void {
    this.addedLineDecoration.dispose()
    this.addedGutterDecoration.dispose()
    for (const slot of this.removedSlotPool) slot.dispose()
    this.removedSlotPool.length = 0
  }

  private _ensurePool(size: number): void {
    while (this.removedSlotPool.length < size) {
      this.removedSlotPool.push(this._createRemovedSlot())
    }
  }

  private _createRemovedSlot(): vscode.TextEditorDecorationType {
    // Each slot renders one virtual ghost line above the anchor.
    // Using `isWholeLine: true` + `display: block` on the ::before
    // is what gives the clean "ghost line" look instead of inline text.
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      before: {
        contentText: '',
        color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
        backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
        margin: '0 0 0 0; padding: 0 8px 0 18px; display: block; white-space: pre; width: 100%; box-sizing: border-box; border-left: 2px solid; border-color: var(--vscode-diffEditor-removedTextBorder); font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); text-decoration: line-through; opacity: 0.92;',
      },
    })
  }

  private _formatRemovedLine(line: string): string {
    // Ensure at least one visible char so the ghost line is not collapsed.
    const trimmed = line.length === 0 ? ' ' : line
    if (trimmed.length > MAX_REMOVED_PREVIEW_CHARS) {
      return trimmed.slice(0, MAX_REMOVED_PREVIEW_CHARS - 1) + '…'
    }
    return trimmed
  }
}
