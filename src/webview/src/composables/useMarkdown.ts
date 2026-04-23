import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { useHighlight } from './useHighlight'

const { highlight } = useHighlight()

/**
 * Custom renderer that integrates shiki for code blocks.
 *
 * Because `marked` renderers are synchronous but shiki is async,
 * we use a two-pass approach:
 *   1. First pass: parse markdown, insert placeholder tokens for code blocks.
 *   2. Second pass: replace placeholders with shiki-highlighted HTML.
 */

// Store pending code blocks for async replacement
const CODE_PREFIX = '___SHIKI_CODE_BLOCK___'
let codeBlocks: Array<{ id: string; code: string; lang: string }> = []
let codeBlockCounter = 0

const marked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const id = `${CODE_PREFIX}${codeBlockCounter++}`
      codeBlocks.push({ id, code: text, lang: lang ?? '' })
      return `<div data-shiki-placeholder="${id}"></div>`
    },
    codespan({ text }: { text: string }) {
      return `<code class="inline-code">${text}</code>`
    },
    link({ href, text }: { href: string; text: string }) {
      return `<a href="${href}" title="${text}" class="md-link">${text}</a>`
    },
  },
  gfm: true,
  breaks: true,
})

export function useMarkdown() {
  /**
   * Render markdown to sanitised HTML with shiki-highlighted code blocks.
   */
  async function renderMarkdown(source: string): Promise<string> {
    // Reset code block collection
    codeBlocks = []
    codeBlockCounter = 0

    // First pass: markdown → HTML with placeholders
    let html = await marked.parse(source)

    // Second pass: replace placeholders with highlighted code
    for (const block of codeBlocks) {
      const highlighted = await highlight(block.code, block.lang)
      const langLabel = block.lang || 'text'

      const codeBlockHtml = `
        <div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-block-lang">${langLabel}</span>
            <button class="code-block-copy" onclick="
              navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(block.code)}'))
                .then(() => { this.textContent = 'Copied!'; setTimeout(() => this.textContent = 'Copy', 2000) })
                .catch(() => { this.textContent = 'Failed'; setTimeout(() => this.textContent = 'Copy', 2000) })
            ">Copy</button>
          </div>
          <div class="code-block-body">${highlighted}</div>
        </div>`

      html = html.replace(
        `<div data-shiki-placeholder="${block.id}"></div>`,
        codeBlockHtml
      )
    }

    // Sanitise output
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['span'],
      ADD_ATTR: ['style', 'class', 'data-shiki-placeholder', 'onclick'],
      ALLOW_DATA_ATTR: true,
    })
  }

  return { renderMarkdown }
}
