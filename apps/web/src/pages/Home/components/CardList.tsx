import { PkgListClickAction } from 'common/types/configStore'
import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Spin } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
import { activeResourceTasks, taskStatusLabel } from '@/utils/taskPresentation'
import type { TableListProps } from './TableList'
import { GameCover } from './GameCover'
import { GameActions } from './GameActions'
import { useContainer } from '@/store/container'
export const CardList = memo(function CardList({
  data,
  loading,
  displayPkgRawTitle,
  clickAction,
  handleInstallByActionType,
}: TableListProps) {
  const {
    ps4Installer: { installTasks, isSendingInstall },
  } = useContainer()
  if (loading) return <Spin tip="正在读取游戏库目录…" />
  if (!data.length) return <Empty description="没有找到符合条件的游戏" />
  return (
    <div className="game-grid">
      {data.map((file) => {
        const tasks = activeResourceTasks(file, installTasks)
        const sending = isSendingInstall(file)
        const title = formatPkgName(file, displayPkgRawTitle)
        const canInstall = !file.resourceId || ['ready', 'partial'].includes(file.parseState || '')
        const platform =
          file.resourcePlatform && file.resourcePlatform !== 'unknown'
            ? ({ ps4: 'PS4', ps5: 'PS5', switch: 'Switch', '3ds': 'Nintendo 3DS' } as Record<string, string>)[
                file.resourcePlatform
              ] || file.resourcePlatform
            : file.paramSfo
              ? 'PS4'
              : /\.pkg$/i.test(file.basename)
                ? 'PKG'
                : '文件'
        const parseLabel = (
          { pending: '等待识别', parsing: '正在识别', unsupported: '暂不支持安装', failed: '读取失败' } as Record<
            string,
            string
          >
        )[file.parseState || '']
        return (
          <div className="game-tile" key={file.resourceId || file.filename}>
            <GameActions file={file} onAction={handleInstallByActionType}>
              <Button
                variant="text"
                className="game-card"
                disabled={sending}
                aria-busy={sending || undefined}
                onClick={() =>
                  handleInstallByActionType(
                    file,
                    canInstall || file.type === 'directory' ? PkgListClickAction.auto : PkgListClickAction.detail,
                  )
                }
              >
                <div className="game-cover">
                  <GameCover file={file} />
                  <span className="game-cover-action">
                    {sending
                      ? '正在发送…'
                      : file.type === 'directory'
                        ? '打开文件夹'
                        : clickAction === PkgListClickAction.install && canInstall
                          ? '安装游戏'
                          : '查看详情'}
                  </span>
                </div>
                <strong title={title}>{title}</strong>
              </Button>
            </GameActions>
            <div className="game-meta">
              <small title={file.type === 'directory' ? '文件夹' : `${platform} · ${formatFileSize(file.size)}`}>
                {file.type === 'directory' ? '文件夹' : `${platform} · ${formatFileSize(file.size)}`}
              </small>
              {!!tasks.length && (
                <Link className="game-task-badge" to="/tasks" aria-label={`查看 ${title} 的安装任务`}>
                  <span aria-hidden="true" />
                  {tasks.length > 1 ? `${tasks.length} 项任务` : taskStatusLabel(tasks[0])}
                </Link>
              )}
            </div>
            {parseLabel && (
              <small className="game-parse-status" title={file.parseMessage}>
                {parseLabel}
              </small>
            )}
          </div>
        )
      })}
    </div>
  )
})
export default CardList
