import { TaskActionType, TaskStatus, type FileStat, type InstallTask } from '@/types'

export const taskActionFeedback = {
  [TaskActionType.PAUSE]: { pending: '正在暂停下载…', success: '已暂停下载', error: '暂停下载失败' },
  [TaskActionType.RESUME]: { pending: '正在继续下载…', success: '继续请求已发送', error: '继续下载失败' },
  [TaskActionType.CANCEL]: { pending: '正在取消任务…', success: '取消请求已执行', error: '取消任务失败' },
  [TaskActionType.DELETE]: { pending: '正在删除记录…', success: '任务记录已删除', error: '删除记录失败' },
  [TaskActionType.RETRY]: { pending: '正在准备重新安装…', success: '安装任务已发送', error: '重新安装失败' },
}

export function taskStatusLabel(task: InstallTask) {
  if (task.pendingSync) return '等待同步'
  if (task.offline) return '主机离线'
  if (task.queryError) return '连接异常'
  if (task.cleanupPending) return '等待清理'
  const labels = {
    queued: '等待中',
    submitting: '正在提交',
    accepted: '等待中',
    transferring: '安装中',
    installing: '安装中',
    completed: '已完成',
    paused: '已暂停',
    failed: '安装失败',
    cancelled: '已取消',
    unknown: '待确认',
  }
  if (task.jobState) return labels[task.jobState]
  return {
    [TaskStatus.INSTALLING]: '安装中',
    [TaskStatus.PAUSED]: '已暂停',
    [TaskStatus.FINISHED]: '已完成',
    [TaskStatus.FAILED]: '安装失败',
    [TaskStatus.CANCELLED]: '已取消',
    [TaskStatus.UNKNOWN]: '待确认',
  }[task.status]
}

export function remainingTimeLabel(seconds: number) {
  if (seconds < 60) return '不到 1 分钟'
  const minutes = Math.ceil(seconds / 60)
  return minutes < 60
    ? `约 ${minutes} 分钟`
    : `约 ${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`
}

/** The cover indicates current attempts for this exact library file/version. */
export function activeResourceTasks(file: FileStat, tasks: InstallTask[]) {
  if (!file.resourceId) return []
  return tasks.filter((task) => {
    if (task.file.resourceId !== file.resourceId || task.supersededBy || task.activity === 'idle') return false
    if (![TaskStatus.INSTALLING, TaskStatus.PAUSED].includes(task.status)) return false
    if (file.fileVersion && task.file.fileVersion !== file.fileVersion) return false
    return file.libraryId
      ? task.file.libraryId === file.libraryId
      : !!file.libraryConnectionId && task.file.libraryConnectionId === file.libraryConnectionId
  })
}
