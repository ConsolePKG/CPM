import { describe, expect, it } from '@rstest/core'
import { applyJob, restoreJobTasks } from '../src/hooks/taskRecovery'
import { canControlJob, canDeleteTask } from '../src/hooks/taskProgress'
import type { Job, JobCapabilities } from '../src/service/jobs'
import { TaskStatus, type FileStat, type InstallTask } from '../src/types'

const host = { id: 'console', url: 'http://ps5:12801' }
const capabilities: JobCapabilities = {
  protocolVersion: 1,
  platform: 'ps5',
  jobs: true,
  pause: false,
  resume: false,
  cancel: false,
  retry: true,
  completionVerified: false,
}
const job: Job = {
  jobId: '7',
  state: 'transferring',
  platform: 'ps5',
  title: 'Persona',
  idempotencyKey: 'attempt-one',
  nativeRef: { content_id: 'content' },
  progress: { total: 100, transferred: 50 },
}
const file: FileStat = {
  filename: 'p5.pkg',
  basename: 'Persona',
  type: 'file',
  size: 100,
  etag: '',
  lastmod: '',
  resourceId: 'resource',
  libraryId: 'library',
  libraryConnectionId: 'dav',
  coverAssetId: 'cover',
}

describe('task recovery across refresh and new installation attempts', () => {
  it('restores library references, cover identity and request identity without combining attempts', () => {
    const files = new Map([[job.jobId, file]])
    const tasks = restoreJobTasks(
      [],
      host,
      [job, { ...job, jobId: '8', idempotencyKey: 'attempt-two' }],
      capabilities,
      files,
    )
    expect(tasks).toHaveLength(2)
    expect(tasks.find((task) => task.jobId === '7')).toMatchObject({
      file,
      fileServerHostId: 'dav',
      idempotencyKey: 'attempt-one',
    })
  })
  it('does not recreate legacy, deleted or missing records after a complete CPI refresh', () => {
    const legacy = { ...job, jobId: '1', recordType: 'legacy' as const, idempotencyKey: 'historical:content' }
    const tasks = restoreJobTasks([], host, [job], capabilities)
    expect(restoreJobTasks([], host, [legacy, { ...job, deleted: true }], capabilities)).toEqual([])
    expect(restoreJobTasks(tasks, { ...host, id: 'renamed-host' }, [], capabilities)).toEqual([])
    expect(restoreJobTasks([], host, [{ ...legacy, recordType: undefined }], capabilities)).toEqual([])
    const pending = { ...tasks[0], jobId: undefined }
    expect(restoreJobTasks([pending], host, [], capabilities)).toHaveLength(1)
  })
  it('removes superseded tasks while keeping a newer attempt with the same Content ID', () => {
    const previous = restoreJobTasks([], host, [job], capabilities)
    const tasks = restoreJobTasks(
      previous,
      host,
      [
        { ...job, supersededBy: '8' },
        { ...job, jobId: '8', idempotencyKey: 'new' },
      ],
      capabilities,
    )
    expect(tasks.map((task) => task.jobId)).toEqual(['8'])
  })
  it('shows native idle as unverified history, permits explicit reinstall and allows explicit resubmission of unknown results', () => {
    const task: InstallTask = {
      file,
      title: 'Persona',
      ps4HostUrl: host.url,
      fileServerHostId: 'dav',
      status: TaskStatus.INSTALLING,
      capabilities,
    }
    const idle = applyJob(task, { ...job, state: 'unknown', nativeState: 'none', activity: 'idle' })
    expect(idle.status).toBe(TaskStatus.UNKNOWN)
    expect(canControlJob(idle, 'retry')).toBe(true)
    expect(canControlJob(applyJob(task, { ...job, state: 'unknown', activity: 'unknown' }), 'retry')).toBe(true)
    expect(canControlJob(applyJob(task, job), 'retry')).toBe(false)
    expect(canDeleteTask(idle)).toBe(true)
    expect(canDeleteTask(applyJob(task, job))).toBe(false)
    expect(canControlJob({ ...idle, jobId: undefined, jobState: 'failed' }, 'retry')).toBe(true)
  })
  it('displays the console snapshot when the original library is unavailable, without substituting a same-ID file from another library', () => {
    const snapshot: Job = {
      ...job,
      resourceId: 'resource',
      resource: {
        libraryId: 'original-library',
        filename: 'patch.pkg',
        size: 200,
        kind: 'patch',
        version: '1.02',
        platform: 'ps4',
        sourceName: 'Library A',
      },
    }
    const old = restoreJobTasks([], host, [job], capabilities, new Map([[job.jobId, file]]))
    const restored = restoreJobTasks(old, host, [snapshot], capabilities)[0]
    expect(restored.file).toMatchObject({ libraryId: 'original-library', size: 200, resourceKind: 'patch' })
    expect(restored.file.coverAssetId).toBeUndefined()
    expect(restored.title).toBe('Persona')
    expect(restored.progressInfo?.transferred).toBe(50)
    expect(restored.offline).toBe(false)
  })
  it('calculates speed and ETA from native sample intervals, with no duplicate samples', () => {
    const original = restoreJobTasks([], host, [job], capabilities)[0]
    const sampled = { ...job, observation: { sessionId: 1, sampleId: 1000, sampledAt: 1000, ageMs: 0 } }
    const first = applyJob(original, sampled)
    expect(first.downloadSpeed).toBeUndefined()
    const next = applyJob(first, {
      ...sampled,
      progress: { total: 100, transferred: 75 },
      observation: { ...sampled.observation, sampleId: 2000 },
    })
    expect(next.downloadSpeed).toBe(25)
    expect(next.progressInfo?.rest_sec).toBe(1)
    const repeated = applyJob(next, {
      ...sampled,
      progress: { total: 100, transferred: 75 },
      observation: { ...sampled.observation, sampleId: 2000 },
    })
    expect(repeated.downloadSpeed).toBe(25)
    expect(repeated.speedHistory).toEqual([25])
    const slow = applyJob(repeated, {
      ...sampled,
      progress: { total: 100, transferred: 95 },
      observation: { ...sampled.observation, sampleId: 4000 },
    })
    expect(slow.downloadSpeed).toBeCloseTo(19.75)
  })
  it('clears estimates on query errors, pause, installation, byte rollback and CPI restart', () => {
    const first = restoreJobTasks(
      [],
      host,
      [{ ...job, observation: { sessionId: 1, sampleId: 1000, sampledAt: 1000, ageMs: 0 } }],
      capabilities,
    )[0]
    const sampled: Job = {
      ...job,
      progress: { total: 100, transferred: 75 },
      observation: { sessionId: 1, sampleId: 2000, sampledAt: 2000, ageMs: 0 },
    }
    const transferring = applyJob(first, sampled)
    expect(transferring.downloadSpeed).toBe(25)
    for (const changed of [
      { ...sampled, queryError: { message: 'query failed', nativeCode: 1 } },
      { ...sampled, state: 'paused' as const },
      { ...sampled, state: 'installing' as const },
      {
        ...sampled,
        progress: { total: 100, transferred: 10 },
        observation: { ...sampled.observation!, sampleId: 3000 },
      },
      { ...sampled, observation: { ...sampled.observation!, sessionId: 2, sampleId: 3000 } },
    ]) {
      const next = applyJob(transferring, changed)
      expect(next.downloadSpeed).toBeUndefined()
      expect(next.progressInfo?.rest_sec).toBe(0)
    }
    const failedQuery = applyJob(transferring, { ...sampled, queryError: { message: 'offline native', nativeCode: 1 } })
    expect(failedQuery.jobState).toBe('transferring')
    expect(failedQuery.offline).toBe(false)
    expect(failedQuery.progressInfo?.transferred).toBe(75)
    expect(failedQuery.queryError).toBeTruthy()
  })
  it('renders a PS5-native pause and retains the progress without speed or ETA', () => {
    const task = restoreJobTasks([], host, [job], capabilities)[0]
    const paused = applyJob(task, { ...job, state: 'paused', nativeState: 'paused' })
    expect(paused.status).toBe(TaskStatus.PAUSED)
    expect(paused.progressInfo?.transferred).toBe(50)
    expect(paused.downloadSpeed).toBeUndefined()
    expect(paused.progressInfo?.rest_sec).toBe(0)
    expect(canControlJob(paused, 'retry')).toBe(false)
  })
  it('handles a missing observation after CPI restart without crashing or preserving estimates', () => {
    const sampled = restoreJobTasks(
      [],
      host,
      [{ ...job, observation: { sessionId: 1, sampleId: 1000, sampledAt: 1000, ageMs: 0 } }],
      capabilities,
    )[0]
    const next = applyJob(sampled, { ...job, state: 'unknown', nativeState: 'none', nativeStatusUnavailable: true })
    expect(next.jobState).toBe('unknown')
    expect(next.downloadSpeed).toBeUndefined()
    expect(next.errorMessage).toContain('待核对')
  })
  it('ignores a delayed queued response after a successful native sample', () => {
    const sampled = restoreJobTasks(
      [],
      host,
      [{ ...job, observation: { sessionId: 1, sampleId: 1000, sampledAt: 1000, ageMs: 0 } }],
      capabilities,
    )[0]
    expect(applyJob(sampled, { ...job, state: 'queued', progress: { transferred: 0, total: 0 } })).toEqual(sampled)
  })
  it('does not retain a cached cover from a different file version, and clears accepted request credentials', () => {
    const original = restoreJobTasks(
      [],
      host,
      [job],
      capabilities,
      new Map([[job.jobId, { ...file, fileVersion: 'old' }]]),
    )[0]
    const restored = restoreJobTasks(
      [{ ...original, submission: { idempotencyKey: 'attempt-one', url: 'secret' } }],
      host,
      [{ ...job, resourceId: 'resource', resource: { libraryId: 'library', fileVersion: 'new' } }],
      capabilities,
    )[0]
    expect(restored.file.fileVersion).toBe('new')
    expect(restored.file.coverAssetId).toBeUndefined()
    expect(restored.submission).toBeUndefined()
  })
})
