import { describe, it, expect, rstest } from '@rstest/core'
const { client } = rstest.hoisted(() => ({
  client: {
    defaults: { baseURL: '' },
    interceptors: { request: { use: () => {} } },
    get: rstest.fn(async () => ({ data: {} })),
    post: rstest.fn(async () => ({ data: {} })),
  },
}))
rstest.mock('axios', () => ({ default: { create: () => client } }))
import {
  apiBaseUrl,
  installApi,
  InstallType,
  changeBaseUrl,
  pauseApi,
  resumeApi,
  cancelApi,
  getTaskProgressApi,
} from '../src/service/ps4'
describe('task host routing', () => {
  it('normalizes existing /api paths without duplicating the suffix', () => {
    expect(apiBaseUrl('http://one:12801/')).toBe('http://one:12801/api')
    expect(apiBaseUrl('http://one:12801/api/')).toBe('http://one:12801/api')
  })
  it('keeps progress and every task action on the originating host after switching', async () => {
    changeBaseUrl('http://two:12801')
    for (const [fn, route] of [
      [getTaskProgressApi, 'get_task_progress'],
      [pauseApi, 'pause_task'],
      [resumeApi, 'resume_task'],
      [cancelApi, 'unregister_task'],
    ] as const) {
      await fn(7, 'http://one:12801')
      expect(client.post).toHaveBeenLastCalledWith('/' + route, { task_id: 7 }, { baseURL: 'http://one:12801/api' })
    }
    const install = { type: InstallType.DIRECT as const, packages: ['http://files/game.pkg'] }
    await installApi(install, 'http://one:12801')
    expect(client.post).toHaveBeenLastCalledWith('/install', install, { baseURL: 'http://one:12801/api' })
    expect(client.defaults.baseURL).toBe('http://two:12801/api')
  })
})
