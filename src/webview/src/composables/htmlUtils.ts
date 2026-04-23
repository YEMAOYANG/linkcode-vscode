/** Escape HTML special characters to prevent injection */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Check if a URL uses a safe scheme */
export function isSafeUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://placeholder.invalid')
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}
