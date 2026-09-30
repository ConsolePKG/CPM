self.onmessage = function () {
  self.postMessage({ fetch: typeof self.fetch === 'function' })
}
