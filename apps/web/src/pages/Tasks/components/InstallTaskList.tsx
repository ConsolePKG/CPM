import { useState } from 'react'
import { Button, Empty } from '@/design-system'
import { useContainer } from '@/store/container'
import { TaskActionType, TaskStatus } from '@/types'
import { formatFileSize } from '@/utils'
import { canControlJob, taskKey } from '@/hooks/taskProgress'
import { TaskCard } from './TaskCard'
import { SpeedChart } from './SpeedChart'
import '../tasks.less'
export function InstallTaskList() {
  const {
    ps4Installer: { installTasks, ps4Hosts, totalSpeedHistory, pendingActions, handleChangeInstallTaskStatus },
  } = useContainer()
  const [busy, setBusy] = useState(false)
  const active = installTasks.filter((task) => task.status === TaskStatus.INSTALLING)
  const downloading = active.filter((task) => task.jobState === 'transferring' && !task.offline && !task.queryError)
  const pausable = active.filter((task) => canControlJob(task, 'pause') && !pendingActions[taskKey(task)])
  const speed = downloading.reduce((sum, task) => sum + (task.downloadSpeed || 0), 0)
  const groups = [
    { title: '进行中', status: TaskStatus.INSTALLING },
    { title: '已暂停', status: TaskStatus.PAUSED },
    { title: '已完成', status: TaskStatus.FINISHED },
    { title: '结果未确认', status: TaskStatus.UNKNOWN },
    { title: '失败', status: TaskStatus.FAILED },
    { title: '已取消', status: TaskStatus.CANCELLED },
  ]
  return (
    <section className="tasks-page" aria-label="安装任务">
      <div className="task-summary">
        <div>
          <span>总下载速度</span>
          <strong>
            {!downloading.length
              ? '—'
              : !downloading.some((task) => task.downloadSpeed !== undefined)
                ? '计算中'
                : formatFileSize(speed)}
            {!!downloading.length && downloading.some((task) => task.downloadSpeed !== undefined) && <small>/s</small>}
          </strong>
        </div>
        <div>
          <span>正在安装</span>
          <strong>
            {
              active.filter(
                (task) =>
                  ['transferring', 'installing'].includes(task.jobState || '') && !task.offline && !task.queryError,
              ).length
            }
            <small>项</small>
          </strong>
        </div>
        <div>
          <span>已暂停</span>
          <strong>
            {installTasks.filter((task) => task.status === TaskStatus.PAUSED).length}
            <small>项</small>
          </strong>
        </div>
        <SpeedChart samples={totalSpeedHistory} />
        {installTasks.some((task) => task.capabilities?.pause) && (
          <Button
            loading={busy}
            disabled={!pausable.length}
            onClick={async () => {
              setBusy(true)
              try {
                await Promise.all(pausable.map((task) => handleChangeInstallTaskStatus(task, TaskActionType.PAUSE)))
              } finally {
                setBusy(false)
              }
            }}
          >
            全部暂停
          </Button>
        )}
      </div>
      {groups.map((group) => {
        const tasks = installTasks.filter((task) => task.status === group.status)
        return tasks.length ? (
          <section className="task-group" key={group.title}>
            <h2>
              {group.title}
              <small>{tasks.length}</small>
            </h2>
            {tasks.map((task) => (
              <TaskCard
                key={taskKey(task)}
                task={task}
                pendingAction={pendingActions[taskKey(task)]}
                hostName={ps4Hosts.find((host) => host.id === task.hostId || host.url === task.ps4HostUrl)?.alias}
                onAction={handleChangeInstallTaskStatus}
              />
            ))}
          </section>
        ) : null
      })}
      {!installTasks.length && <Empty description="暂无安装任务，可从游戏库发送安装。" />}
    </section>
  )
}
