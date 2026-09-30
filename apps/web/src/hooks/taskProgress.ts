import type { InstallTask } from '@/types'
export const taskKey = (
  task: Pick<InstallTask, 'taskId' | 'contentId' | 'ps4HostUrl' | 'hostId' | 'jobId' | 'idempotencyKey'>,
) => `${task.hostId || task.ps4HostUrl}#${task.jobId || task.idempotencyKey || task.contentId || task.taskId}`
export function canControlJob(task: InstallTask, action: 'pause' | 'resume' | 'cancel' | 'retry') {
  if (!task.jobId || task.offline || !task.capabilities?.[action]) return false
  if (action === 'retry') return ['failed', 'cancelled', 'completed'].includes(task.jobState || '')
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
