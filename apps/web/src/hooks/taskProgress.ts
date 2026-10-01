import type { InstallTask } from '@/types'
import type { Job } from '@/service/jobs'
export const taskKey = (
  task: Pick<InstallTask, 'taskId' | 'contentId' | 'ps4HostUrl' | 'hostId' | 'jobId' | 'idempotencyKey'>,
) => `${task.hostId || task.ps4HostUrl}#${task.jobId || task.idempotencyKey || task.contentId || task.taskId}`
export function canControlJob(task: InstallTask, action: 'pause' | 'resume' | 'cancel' | 'retry') {
  if (action === 'retry')
    return (
      !task.offline &&
      (['failed', 'cancelled', 'completed', 'unknown'].includes(task.jobState || '') || task.activity === 'idle')
    )
  if (!task.jobId || task.offline || !task.capabilities?.[action]) return false
  if (action === 'resume') return task.jobState === 'paused'
  return ['accepted', 'transferring', 'installing', ...(action === 'cancel' ? ['paused'] : [])].includes(
    task.jobState || '',
  )
}
export function sampleTransfer(
  previous: Pick<InstallTask, 'sampleTime' | 'sampleTransferred' | 'speedHistory'>,
  transferred: number,
  now: number,
) {
  const elapsed = previous.sampleTime === undefined ? 0 : (now - previous.sampleTime) / 1000
  const delta = transferred - (previous.sampleTransferred ?? transferred)
  const downloadSpeed = elapsed > 0 && delta >= 0 ? delta / elapsed : undefined
  return {
    sampleTime: now,
    sampleTransferred: transferred,
    downloadSpeed,
    speedHistory:
      downloadSpeed === undefined
        ? previous.speedHistory || []
        : [...(previous.speedHistory || []).slice(-19), downloadSpeed],
  }
}

export function transferPercent(transferred: number, total: number) {
  if (!Number.isFinite(transferred) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.floor((transferred / total) * 100)))
}

export function canDeleteTask(task: InstallTask) {
  if (!task.jobId && task.submission && task.jobState !== 'failed') return false
  return (
    !['queued', 'submitting', 'accepted', 'transferring', 'installing', 'paused'].includes(task.jobState || '') ||
    task.activity === 'idle'
  )
}

export function sampleJobTransfer(task: InstallTask, job: Job) {
  const observation = job.observation
  const clear = {
    sampleTime: undefined,
    sampleTransferred: undefined,
    nativeSampleId: observation?.sampleId,
    nativeSessionId: observation?.sessionId,
    downloadSpeed: undefined,
    speedHistory: [] as number[],
    remainingSeconds: 0,
  }
  if (
    !observation ||
    job.queryError ||
    observation.ageMs > 10000 ||
    job.state !== 'transferring' ||
    job.activity === 'idle'
  )
    return clear
  const sample = {
    nativeSampleId: observation.sampleId,
    nativeSessionId: observation.sessionId,
    sampleTime: observation.sampleId,
    sampleTransferred: job.progress.transferred,
  }
  const estimate = (speed?: number) =>
    speed && speed > 0 && job.progress.total > job.progress.transferred
      ? Math.ceil((job.progress.total - job.progress.transferred) / speed)
      : 0
  if (
    task.nativeSessionId !== observation.sessionId ||
    task.sampleTime === undefined ||
    observation.sampleId < task.sampleTime ||
    job.progress.transferred < (task.sampleTransferred ?? 0)
  )
    return { ...clear, ...sample }
  if (observation.sampleId === task.sampleTime)
    return {
      ...sample,
      downloadSpeed: task.downloadSpeed,
      speedHistory: task.speedHistory || [],
      remainingSeconds: estimate(task.downloadSpeed),
    }
  const rawSpeed =
    ((job.progress.transferred - (task.sampleTransferred ?? job.progress.transferred)) * 1000) /
    (observation.sampleId - task.sampleTime)
  const downloadSpeed = rawSpeed > 0 ? (task.downloadSpeed ? task.downloadSpeed * 0.65 + rawSpeed * 0.35 : rawSpeed) : 0
  return {
    ...sample,
    downloadSpeed,
    speedHistory: [...(task.speedHistory || []).slice(-19), downloadSpeed],
    remainingSeconds: estimate(downloadSpeed),
  }
}
