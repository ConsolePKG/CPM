import { expect, it } from '@rstest/core'
import { initializeLocalConsole } from '../src/hooks/localConsole'

it('initializes an already saved empty list on PS4', () => {
  const result = initializeLocalConsole([], undefined, true)
  expect(result.hosts[0].url).toBe('http://127.0.0.1:12801')
  expect(result.selected).toBe(result.hosts[0].id)
})
it('keeps an existing selection and reuses an existing loopback host', () => {
  const hosts = [{ id: 'custom', url: 'http://localhost:12801' }]
  expect(initializeLocalConsole(hosts, 'custom', true)).toEqual({ hosts, selected: 'custom' })
  const remote = [{ id: 'remote', url: 'http://192.168.1.8:12801' }]
  const result = initializeLocalConsole(remote, 'remote', true)
  expect(result.hosts).toHaveLength(2)
  expect(result.selected).toBe('remote')
})
it('does not recreate a deleted host after initialization or on desktop', () => {
  expect(initializeLocalConsole([], undefined, false)).toEqual({ hosts: [], selected: undefined })
})
