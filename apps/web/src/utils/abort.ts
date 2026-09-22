/** AbortSignal.throwIfAborted is missing in older WebKit. */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}
