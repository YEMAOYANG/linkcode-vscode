import { createHighlighter, type Highlighter } from 'shiki'

let highlighterInstance: Highlighter | null = null
const loadedLanguages = new Set<string>()
let initPromise: Promise<Highlighter> | null = null

const THEME = 'github-dark'

/**
 * Lazily initialize the shiki highlighter (singleton).
 * Languages are loaded on-demand via `ensureLanguage`.
 */
async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return highlighterInstance

  if (!initPromise) {
    const defaultLangs = ['javascript', 'typescript', 'html', 'css', 'json', 'markdown', 'python', 'bash', 'shell'] as const
    initPromise = createHighlighter({
      themes: [THEME],
      langs: [...defaultLangs],
    }).then((hl) => {
      highlighterInstance = hl
      for (const lang of defaultLangs) {
        loadedLanguages.add(lang)
      }
      return hl
    })
  }

  return initPromise
}

async function ensureLanguage(hl: Highlighter, lang: string): Promise<string> {
  // Normalize common aliases
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    zsh: 'bash',
    yml: 'yaml',
    text: 'plaintext',
    txt: 'plaintext',
    '': 'plaintext',
  }

  const resolved = aliases[lang] ?? lang

  if (resolved === 'plaintext') return resolved
  if (loadedLanguages.has(resolved)) return resolved

  try {
    await hl.loadLanguage(resolved as Parameters<Highlighter['loadLanguage']>[0])
    loadedLanguages.add(resolved)
    return resolved
  } catch {
    // Fallback to plaintext if the language bundle doesn't exist
    return 'plaintext'
  }
}

export function useHighlight() {
  /**
   * Highlight a code string. Returns an HTML string.
   * Falls back to `<pre><code>` with escaping when the highlighter isn't ready.
   */
  async function highlight(code: string, lang: string): Promise<string> {
    try {
      const hl = await getHighlighter()
      const resolvedLang = await ensureLanguage(hl, lang)

      if (resolvedLang === 'plaintext') {
        return `<pre><code>${escapeHtml(code)}</code></pre>`
      }

      return hl.codeToHtml(code, {
        lang: resolvedLang,
        theme: THEME,
      })
    } catch {
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    }
  }

  return { highlight }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
