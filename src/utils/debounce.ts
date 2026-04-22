/**
 * Creates a debounced version of the given function.
 * The debounced function delays invoking `fn` until after `delayMs`
 * milliseconds have elapsed since the last invocation.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  return (...args: Parameters<T>) => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      fn(...args)
      timer = undefined
    }, delayMs)
  }
}
