import { randomBytes } from 'crypto'

/**
 * Generate a cryptographically random nonce string for WebView CSP.
 * Uses Node.js crypto module instead of Math.random() for security.
 */
export function getNonce(): string {
  return randomBytes(24).toString('base64url')
}
