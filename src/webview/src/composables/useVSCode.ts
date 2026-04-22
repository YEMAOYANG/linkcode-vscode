/**
 * Typed wrapper around VS Code's WebView API.
 * acquireVsCodeApi() is available globally in WebView context.
 */

interface VSCodeApi {
  postMessage(message: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

declare function acquireVsCodeApi(): VSCodeApi

let vscodeApi: VSCodeApi | undefined

function getApi(): VSCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi()
  }
  return vscodeApi
}

export function useVSCode() {
  const api = getApi()

  function postMessage(message: Record<string, unknown>): void {
    api.postMessage(message)
  }

  function getState<T = unknown>(): T | undefined {
    return api.getState() as T | undefined
  }

  function setState<T = unknown>(state: T): void {
    api.setState(state)
  }

  function onMessage(handler: (event: MessageEvent) => void): () => void {
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }

  return {
    postMessage,
    getState,
    setState,
    onMessage,
  }
}
