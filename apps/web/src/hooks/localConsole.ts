import type { PS4Host } from '@/types'

export const localConsoleSetupKey = 'cpm.localConsoleInitialized.v1'
export function initializeLocalConsole(hosts: PS4Host[], selected: string | undefined, enabled: boolean) {
  if (!enabled) return { hosts, selected }
  const existing = hosts.find((host) => {
    try {
      const url = new URL(host.url)
      return ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '12801'
    } catch {
      return false
    }
  })
  const local = existing || { id: 'ps4-local-console', alias: '本机 PS4', url: 'http://127.0.0.1:12801' }
  return {
    hosts: existing ? hosts : [...hosts, local],
    selected: hosts.some((host) => host.id === selected) ? selected : local.id,
  }
}
