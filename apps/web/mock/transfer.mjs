// Integrate a smooth synthetic rate over elapsed time, independent of polling frequency.
const MiB = 1024 ** 2
export function mockRate(seconds, phase = 0) {
  return (48 + 20 * Math.sin(seconds / 7 + phase) + 9 * Math.sin(seconds / 2.7 + phase * 2)) * MiB
}
function cumulativeBytes(seconds, phase) {
  return (48 * seconds - 140 * Math.cos(seconds / 7 + phase) - 24.3 * Math.cos(seconds / 2.7 + phase * 2)) * MiB
}
export function advanceTransfer(task, now = Date.now()) {
  const elapsed = Math.max(0, (now - task.updatedAt) / 1000)
  if (!task.paused) {
    const end = task.activeSeconds + elapsed
    task.transferred = Math.min(
      task.total,
      task.transferred + cumulativeBytes(end, task.phase) - cumulativeBytes(task.activeSeconds, task.phase),
    )
    task.activeSeconds = end
  }
  task.updatedAt = now
  return Math.ceil((task.total - task.transferred) / mockRate(task.activeSeconds, task.phase))
}
