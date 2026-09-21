import { useState } from 'react'
import { Pause, Play, Trash2, X } from 'react-feather'
import { Button, IconButton, Progress, ConfirmDialog } from '@/design-system'
import { type InstallTask, TaskActionType, TaskStatus } from '@/types'
import { formatFileSize } from '@/utils'
import { GameCover } from '@/pages/Home/components/GameCover'
export function TaskCard({
  task,
  onAction,
}: {
  task: InstallTask
  onAction: (task: InstallTask, action: TaskActionType) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState<TaskActionType>()
  const active = task.status === TaskStatus.INSTALLING
  const complete = task.status === TaskStatus.FINISHED
  const percent = task.progressInfo?._percent || 0
  const remaining = task.progressInfo?.rest_sec
  const status = task.errorMessage ? '出错' : active ? '下载中' : complete ? '已完成' : '已暂停'
  const act = async (action: TaskActionType) => {
    setBusy(true)
    try {
      await onAction(task, action)
    } finally {
      setBusy(false)
      setConfirmation(undefined)
    }
  }
  return (
    <article className={`task-card ${active ? 'is-downloading' : 'is-compact'}`}>
      <div className="game-cover task-cover">
        <GameCover file={task.file} />
      </div>
      <div className="task-copy">
        <div className="task-title">
          <h2>{task.title || task.file.basename}</h2>
          <span className={task.errorMessage ? 'task-error' : 'muted'}>{status}</span>
        </div>
        <p className="task-host">PS4 · {task.ps4HostUrl}</p>
        <div className="task-progress-label">
          <strong>
            {status} {percent}%
          </strong>
          <span>
            {active && remaining && remaining > 0
              ? `剩余 ${Math.floor(remaining / 60)} 分 ${Math.round(remaining % 60)} 秒`
              : complete
                ? '安装完成'
                : '—'}
          </span>
        </div>
        <Progress active={active && !task.errorMessage} percent={percent} label={`${task.title} 安装进度`} />
        <div className="task-facts">
          <span>
            {formatFileSize(task.progressInfo?.transferred_total || 0)} /{' '}
            {formatFileSize(task.progressInfo?.length_total || task.file.size)}
          </span>
          {active && (
            <span>下载 {task.downloadSpeed === undefined ? '采样中…' : `${formatFileSize(task.downloadSpeed)}/s`}</span>
          )}
        </div>
        {task.errorMessage && (
          <p className="task-error" role="alert">
            {task.errorMessage}
          </p>
        )}
      </div>
      <div className="task-actions">
        {!complete && (
          <IconButton
            label={active ? '暂停任务' : '继续任务'}
            loading={busy}
            onClick={() => act(active ? TaskActionType.PAUSE : TaskActionType.RESUME)}
          >
            {active ? <Pause /> : <Play />}
          </IconButton>
        )}
        {!complete && (
          <IconButton
            label="取消安装任务"
            variant="text"
            disabled={busy}
            onClick={() => setConfirmation(TaskActionType.CANCEL)}
          >
            <X />
          </IconButton>
        )}
        <IconButton
          label="删除任务记录"
          variant="text"
          disabled={busy}
          onClick={() => setConfirmation(TaskActionType.DELETE)}
        >
          <Trash2 />
        </IconButton>
      </div>
      <ConfirmDialog
        visible={Boolean(confirmation)}
        title={confirmation === TaskActionType.DELETE ? '删除任务记录？' : '取消安装任务？'}
        description={
          confirmation === TaskActionType.DELETE
            ? '只从当前任务列表移除，主机上的安装不会被取消。'
            : '向原安装主机发送取消请求，停止此任务。'
        }
        confirmText={confirmation === TaskActionType.DELETE ? '删除记录' : '取消任务'}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => confirmation && act(confirmation)}
      />
    </article>
  )
}
