import { useState } from 'react'
import { Pause, Play, Trash2 } from 'react-feather'
import { Button, IconButton, Progress, ConfirmDialog, Disclosure } from '@/design-system'
import { type InstallTask, TaskActionType, TaskStatus } from '@/types'
import { formatFileSize } from '@/utils'
import { remainingTimeLabel, taskActionFeedback, taskStatusLabel } from '@/utils/taskPresentation'
import { GameCover } from '@/pages/Home/components/GameCover'
import { canControlJob, canDeleteTask } from '@/hooks/taskProgress'
export function TaskCard({
  task,
  hostName,
  onAction,
  pendingAction,
}: {
  task: InstallTask
  hostName?: string
  onAction: (task: InstallTask, action: TaskActionType) => Promise<void>
  pendingAction?: TaskActionType
}) {
  const [localAction, setLocalAction] = useState<TaskActionType>()
  const currentAction = localAction || pendingAction
  const busy = !!currentAction
  const [confirmation, setConfirmation] = useState<TaskActionType>()
  const active = task.status === TaskStatus.INSTALLING
  const complete = task.status === TaskStatus.FINISHED
  const paused = task.status === TaskStatus.PAUSED
  const canPause = canControlJob(task, 'pause')
  const canResume = canControlJob(task, 'resume')
  const canCancel = canControlJob(task, 'cancel')
  const status = currentAction ? taskActionFeedback[currentAction].pending : taskStatusLabel(task)
  const title = task.title || task.file.basename
  const platform = (task.platform || 'ps4').toUpperCase()
  const destination = hostName || task.ps4HostUrl.replace(/^https?:\/\//, '')
  const kind =
    ({ base: '本体', patch: '补丁', dlc: 'DLC', unknown: '安装包' } as Record<string, string>)[
      task.packageType || task.file.resourceKind || 'unknown'
    ] || '安装包'
  const version = task.file.resourceMetadata?.version || task.file.paramSfo?.APP_VER
  const percent = complete ? 100 : Math.max(0, Math.min(100, task.progressInfo?._percent || 0))
  const total = task.progressInfo?.length_total || task.file.size
  const transferred = task.progressInfo?.transferred_total || 0
  const remaining = task.progressInfo?.rest_sec
  const transferring =
    active && (!task.jobState || task.jobState === 'transferring') && !task.offline && !task.queryError
  const hasProgress = (active || paused) && !task.pendingSync && !['queued', 'submitting'].includes(task.jobState || '')
  const tone =
    task.offline || task.queryError || task.pendingSync
      ? 'muted'
      : task.status === TaskStatus.FAILED
        ? 'danger'
        : complete
          ? 'success'
          : active
            ? 'active'
            : 'muted'
  const note = task.queryError
    ? '暂时无法获取主机状态，显示最近一次进度。'
    : task.offline
      ? '连接恢复后会自动更新进度。'
      : task.errorMessage ||
        (task.pendingSync
          ? '正在确认主机是否已接收任务。'
          : task.jobState === 'queued'
            ? '等待主机开始下载。'
            : task.jobState === 'submitting'
              ? '正在向主机提交安装请求。'
              : paused && !canResume
                ? `在 ${platform} 上继续下载。`
                : task.jobState === 'installing' && percent >= 100
                  ? '下载已完成，主机正在处理安装。'
                  : undefined)
  const act = async (action: TaskActionType) => {
    if (busy) return
    setLocalAction(action)
    try {
      await onAction(task, action)
    } finally {
      setLocalAction(undefined)
      setConfirmation(undefined)
    }
  }
  return (
    <article className={`task-card ${active || paused ? 'has-progress' : 'is-compact'}`}>
      <div className="game-cover task-cover">
        <GameCover file={task.file} compact />
      </div>
      <div className="task-copy">
        <div className="task-title">
          <h3 title={title}>{title}</h3>
          <div className="task-controls">
            <span className="task-status" data-tone={tone} aria-live="polite">
              {status}
            </span>
            <div className="task-actions">
              {canControlJob(task, 'retry') && (
                <Button
                  disabled={busy}
                  loading={currentAction === TaskActionType.RETRY}
                  onClick={() => act(TaskActionType.RETRY)}
                >
                  重新安装
                </Button>
              )}
              {!complete && !task.cleanupPending && (canPause || canResume) && (
                <IconButton
                  label={currentAction ? taskActionFeedback[currentAction].pending : canPause ? '暂停下载' : '继续下载'}
                  disabled={busy}
                  loading={currentAction === TaskActionType.PAUSE || currentAction === TaskActionType.RESUME}
                  onClick={() => act(canPause ? TaskActionType.PAUSE : TaskActionType.RESUME)}
                >
                  {currentAction !== TaskActionType.PAUSE &&
                    currentAction !== TaskActionType.RESUME &&
                    (canPause ? <Pause /> : <Play />)}
                </IconButton>
              )}
              {(canCancel || canDeleteTask(task)) && (
                <IconButton
                  label={canCancel ? '取消下载' : '删除记录'}
                  variant="text"
                  disabled={busy}
                  loading={currentAction === TaskActionType.CANCEL || currentAction === TaskActionType.DELETE}
                  onClick={() => setConfirmation(canCancel ? TaskActionType.CANCEL : TaskActionType.DELETE)}
                >
                  {currentAction !== TaskActionType.CANCEL && currentAction !== TaskActionType.DELETE && <Trash2 />}
                </IconButton>
              )}
            </div>
          </div>
        </div>
        <p className="task-meta">
          <span>
            {kind}
            {version && ` · v${version}`}
          </span>
          <span>
            目标 {platform}
            {destination !== platform && ` / ${destination}`}
          </span>
        </p>
        {hasProgress && (
          <div className="task-transfer">
            <div className="task-progress-label">
              <span>
                {formatFileSize(transferred)}{' '}
                <span className="muted">/ {total > 0 ? formatFileSize(total) : '大小待确认'}</span>
              </span>
              <strong>{total > 0 || complete ? `${percent}%` : '—'}</strong>
            </div>
            <Progress active={transferring} percent={percent} label={`${title} 下载进度`} />
            {transferring && (
              <div className="task-facts">
                <span>
                  {task.downloadSpeed === undefined ? '正在计算速度…' : `${formatFileSize(task.downloadSpeed)}/s`}
                </span>
                {!!remaining && remaining > 0 && <span>剩余{remainingTimeLabel(remaining)}</span>}
              </div>
            )}
          </div>
        )}
        {note && (
          <p
            className={`task-note ${tone === 'danger' ? 'task-error' : ''}`}
            role={tone === 'danger' ? 'alert' : undefined}
          >
            {note}
          </p>
        )}
        <Disclosure title="任务详情" className="task-details">
          <dl>
            <div>
              <dt>目标主机</dt>
              <dd>{task.ps4HostUrl}</dd>
            </div>
            {task.sourceName && (
              <div>
                <dt>资源库</dt>
                <dd>{task.sourceName}</dd>
              </div>
            )}
            <div>
              <dt>文件</dt>
              <dd>{task.file.basename}</dd>
            </div>
            <div>
              <dt>大小</dt>
              <dd>{total > 0 ? formatFileSize(total) : '待确认'}</dd>
            </div>
            {task.titleId && (
              <div>
                <dt>Title ID</dt>
                <dd>{task.titleId}</dd>
              </div>
            )}
            {task.contentId && (
              <div>
                <dt>Content ID</dt>
                <dd>{task.contentId}</dd>
              </div>
            )}
            {task.jobId && (
              <div>
                <dt>任务编号</dt>
                <dd>{task.jobId}</dd>
              </div>
            )}
            {!!(task.lastObservedAt || task.lastSyncedAt) && (
              <div>
                <dt>最近更新</dt>
                <dd>{new Date(task.lastObservedAt || task.lastSyncedAt!).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {task.resourceUnavailable && (
            <p className="task-note">原资源库未连接或文件不可用，重新安装前需恢复资源连接。</p>
          )}
        </Disclosure>
      </div>
      <ConfirmDialog
        visible={Boolean(confirmation)}
        title={confirmation === TaskActionType.DELETE ? '删除任务记录？' : '取消下载？'}
        description={
          confirmation === TaskActionType.DELETE
            ? '删除后各客户端会同步移除这条记录，不会卸载主机上的游戏。'
            : '停止并取消下载，不会卸载已安装的本体、补丁或 DLC。'
        }
        confirmText={confirmation === TaskActionType.DELETE ? '删除记录' : '确认取消'}
        loading={busy}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => confirmation && act(confirmation)}
      />
    </article>
  )
}
