/**
 * Detects the current platform (macOS vs Windows/Linux) in VSCode WebView
 * and returns platform-appropriate modifier key symbols.
 */
export function usePlatform() {
  const isMac =
    navigator.platform.toLowerCase().includes('mac') ||
    navigator.userAgent.toLowerCase().includes('mac')

  /** Primary modifier key: ⌘ on Mac, Ctrl on Windows/Linux */
  const modKey = isMac ? '⌘' : 'Ctrl'
  /** Alt/Option key: ⌥ on Mac, Alt on Windows/Linux */
  const altKey = isMac ? '⌥' : 'Alt'
  /** Shift key symbol */
  const shiftKey = '⇧'

  return { isMac, modKey, altKey, shiftKey }
}
