import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { useHighlight } from './useHighlight'
import { escapeHtml, isSafeUrl } from './htmlUtils'

const { highlight } = useHighlight()

/**
 * Custom renderer that integrates shiki for code blocks.
 *
 * Because `marked` renderers are synchronous but shiki is async,
 * we use a two-pass approach:
 *   1. First pass: parse markdown, insert placeholder tokens for code blocks.
 *   2. Second pass: replace placeholders with shiki-highlighted HTML.
 */

export function useMarkdown() {
  /**
   * Render markdown to sanitised HTML with shiki-highlighted code blocks.
   */
  /**
   * Parse fence info like `ts:filename.ts:15-28` → { lang, filename, lineRange }.
   */
  function parseFenceInfo(info: string): { lang: string; filename?: string; lineRange?: string } {
    if (!info) return { lang: 'text' }
    const parts = info.split(':')
    const lang = parts[0] || 'text'
    if (parts.length === 1) return { lang }
    // Heuristic: a token with a file extension is the filename
    let filename: string | undefined
    let lineRange: string | undefined
    for (const p of parts.slice(1)) {
      if (/^\d+(-\d+)?$/.test(p)) {
        lineRange = p
      } else if (p) {
        filename = p
      }
    }
    return { lang, filename, lineRange }
  }

  async function renderMarkdown(source: string): Promise<string> {
    // Per-call state to avoid race conditions between concurrent renders
    const codeBlocks: Array<{ id: string; code: string; info: string }> = []
    let counter = 0
    const CODE_PREFIX = '___SHIKI_CODE_BLOCK___'

    const localMarked = new Marked({
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          const id = `${CODE_PREFIX}${counter++}`
          codeBlocks.push({ id, code: text, info: lang ?? '' })
          return `<div data-shiki-placeholder="${id}"></div>`
        },
        codespan({ text }: { text: string }) {
          return `<code class="inline-code">${escapeHtml(text)}</code>`
        },
        link({ href, text }: { href: string; text: string }) {
          const safeHref = isSafeUrl(href) ? href : '#'
          return `<a href="${escapeHtml(safeHref)}" title="${escapeHtml(text)}" class="md-link">${text}</a>`
        },
      },
      gfm: true,
      breaks: true,
    })

    // First pass: markdown → HTML with placeholders
    let html = await localMarked.parse(source)

    // Second pass: replace placeholders with highlighted code
    for (const block of codeBlocks) {
      const { lang, filename, lineRange } = parseFenceInfo(block.info)
      const highlighted = await highlight(block.code, lang)
      const encodedCode = encodeURIComponent(block.code)
      const encodedFilename = filename ? encodeURIComponent(filename) : ''
      const encodedLang = encodeURIComponent(lang)

      const fileBadge = filename
        ? `<span class="code-block-filename" title="${escapeHtml(filename)}">${escapeHtml(filename)}</span>`
        : ''
      const rangeBadge = lineRange
        ? `<span class="code-block-range">${escapeHtml(lineRange)}</span>`
        : ''

      const codeBlockHtml = `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-block-lang">${escapeHtml(lang || 'text')}</span>
            ${fileBadge}
            ${rangeBadge}
            <div class="code-block-actions">
              <button class="code-block-apply" data-code="${encodedCode}" data-filename="${encodedFilename}" data-lang="${encodedLang}" data-linerange="${lineRange ?? ''}" title="将代码应用到编辑器（显示 Diff 预览）">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Apply</span>
              </button>
              <button class="code-block-copy" data-code="${encodedCode}">Copy</button>
            </div>
          </div>
          <div class="code-block-body">${highlighted}</div>
        </div>`

      html = html.replace(
        `<div data-shiki-placeholder="${block.id}"></div>`,
        codeBlockHtml,
      )
    }

    // Sanitise output — no onclick allowed, use data attributes + event delegation
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['span', 'svg', 'polyline', 'path', 'circle', 'line'],
      ADD_ATTR: ['style', 'class', 'data-code', 'data-filename', 'data-lang', 'title', 'aria-hidden'],
      ALLOW_DATA_ATTR: true,
    })
  }

  return { renderMarkdown }
}
