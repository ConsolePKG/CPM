import { useState } from 'react'
import { Button, Empty, SegmentedControl } from '@/design-system'
import { useContainer } from '@/store/container'
import { TaskActionType, TaskStatus } from '@/types'
import { formatFileSize } from '@/utils'
import { taskKey } from '@/hooks/taskProgress'
import { TaskCard } from './TaskCard'
import '../tasks.less'
export function InstallTaskList() {
  const {
    ps4Installer: { installTasks, handleChangeInstallTaskStatus },
  } = useContainer()
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const active = installTasks.filter((task) => task.status === TaskStatus.INSTALLING)
  const speed = active.reduce((sum, task) => sum + (task.downloadSpeed || 0), 0)
  const groups = [
    { title: '正在下载', status: TaskStatus.INSTALLING },
    { title: '已暂停', status: TaskStatus.PAUSED },
    { title: '已完成', status: TaskStatus.FINISHED },
  ]
  return (
    <div className="tasks-page">
      <div className="tasks-heading">
        <h1>
          安装任务 <small>{installTasks.length}</small>
        </h1>
        <SegmentedControl
          label="筛选任务"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: '全部' },
            { value: TaskStatus.INSTALLING, label: '下载中' },
            { value: TaskStatus.PAUSED, label: '已暂停' },
            { value: TaskStatus.FINISHED, label: '已完成' },
          ]}
        />
      </div>
      <div className="task-summary">
        <div>
          <span>总下载速度</span>
          <strong>
            {active.length && !active.some((task) => task.downloadSpeed !== undefined)
              ? '采样中'
              : formatFileSize(speed)}
            <small>{active.length && !active.some((task) => task.downloadSpeed !== undefined) ? '' : '/s'}</small>
          </strong>
        </div>
        <div>
          <span>正在下载</span>
          <strong>
            {active.length}
            <small>个游戏</small>
          </strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>
            {installTasks.filter((task) => task.status === TaskStatus.FINISHED).length}
            <small>个游戏</small>
          </strong>
        </div>
        <Button
          loading={busy}
          disabled={!active.length}
          onClick={async () => {
            setBusy(true)
            try {
              await Promise.all(active.map((task) => handleChangeInstallTaskStatus(task, TaskActionType.PAUSE)))
            } finally {
              setBusy(false)
            }
          }}
        >
          全部暂停
        </Button>
      </div>
      {groups
        .filter((group) => filter === 'all' || filter === group.status)
        .map((group) => {
          const tasks = installTasks.filter((task) => task.status === group.status)
          return tasks.length ? (
            <section className="task-group" key={group.status}>
              <h3>
                {group.title}
                <small>{tasks.length}</small>
              </h3>
              {tasks.map((task) => (
                <TaskCard key={taskKey(task)} task={task} onAction={handleChangeInstallTaskStatus} />
              ))}
            </section>
          ) : null
        })}
      {!installTasks.some((task) => filter === 'all' || task.status === filter) && (
        <Empty description="暂无安装任务，可从游戏库发送安装。" />
      )}
    </div>
  )
}
