import type { InstallTask } from '@/types'
export const taskKey = (task: Pick<InstallTask, 'taskId' | 'ps4HostUrl'>) => `${task.ps4HostUrl}#${task.taskId}`
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
