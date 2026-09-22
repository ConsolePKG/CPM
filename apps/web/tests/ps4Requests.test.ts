import { expect, it, rstest } from '@rstest/core'

const requests = rstest.hoisted(() => ({ get: rstest.fn() }))
rstest.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: { request: { use: rstest.fn() } },
      get: requests.get,
    }),
  },
}))
rstest.mock('@/utils', () => ({ isInPS4Browser: true }))
import { installApi, InstallType, getTaskProgressApi, pauseApi, resumeApi } from '../src/service/ps4'

it('sends CPI GET data as a JSON string, preserving package URL characters', () => {
  const data = { type: InstallType.DIRECT, packages: ['http://nas/游戏.pkg?token=a&part=1'] }
  installApi(data, 'http://127.0.0.1:12801')
  const [endpoint, config] = requests.get.mock.calls.at(-1)!
  expect(endpoint).toBe('/install')
  expect(config.baseURL).toBe('http://127.0.0.1:12801/api')
  expect(typeof config.params.data).toBe('string')
  expect(JSON.parse(config.params.data)).toEqual(data)
})

it('serializes progress, pause and resume task parameters the same way', () => {
  for (const api of [getTaskProgressApi, pauseApi, resumeApi]) {
    api(42, 'http://127.0.0.1:12801')
    expect(requests.get.mock.calls.at(-1)![1].params).toEqual({ data: '{"task_id":42}' })
  }
})
