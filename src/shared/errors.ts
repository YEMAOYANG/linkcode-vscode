/**
 * Custom error classes for the LinkCode extension.
 * Provides structured error handling with error codes.
 */

/**
 * Base error class for all LinkCode errors.
 */
export class LinkCodeError extends Error {
  public readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'LinkCodeError'
    this.code = code
  }
}

/**
 * Thrown when an API request fails (network, server error, etc.).
 */
export class ApiError extends LinkCodeError {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message, 'API_ERROR')
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Thrown when authentication fails (missing or invalid API key).
 */
export class AuthError extends LinkCodeError {
  constructor(message: string, public readonly group?: string) {
    super(message, 'AUTH_ERROR')
    this.name = 'AuthError'
  }
}
