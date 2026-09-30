import { PkgListClickAction } from 'common/types/configStore'
import { memo } from 'react'
import { Button, Empty, Spin } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
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
    ps4Installer: { installTasks },
  } = useContainer()
  if (loading) return <Spin tip="正在读取游戏库目录…" />
  if (!data.length) return <Empty description="没有找到符合条件的游戏" />
  return (
    <div className="game-grid">
      {data.map((file) => (
        <GameActions key={file.filename} file={file} onAction={handleInstallByActionType}>
          <Button
            variant="text"
            className="game-card"
            onClick={() => handleInstallByActionType(file, PkgListClickAction.auto)}
          >
            <div className="game-cover">
              <GameCover file={file} />
              <span className="game-cover-action">
                {file.type === 'directory'
                  ? '打开文件夹'
                  : clickAction === PkgListClickAction.install
                    ? '安装游戏'
                    : '查看详情'}
              </span>
            </div>
            <strong title={formatPkgName(file, displayPkgRawTitle)}>{formatPkgName(file, displayPkgRawTitle)}</strong>
            <small>
              {file.type === 'directory'
                ? '文件夹'
                : `${file.resourcePlatform?.toUpperCase() || (file.resourceId ? 'UNKNOWN' : 'PS4')} · ${formatFileSize(file.size)}`}
            </small>
            {file.parseState && file.parseState !== 'ready' && (
              <small title={file.parseMessage}>
                {
                  (
                    {
                      pending: '等待解析',
                      parsing: '解析中',
                      partial: '部分元数据',
                      unsupported: '格式暂不支持',
                      failed: '解析失败，可在菜单重试',
                    } as Record<string, string>
                  )[file.parseState]
                }
              </small>
            )}
            {installTasks
              .filter(
                (task) =>
                  task.file.resourceId === file.resourceId &&
                  !!file.resourceId &&
                  task.file.libraryConnectionId === file.libraryConnectionId &&
                  !['completed', 'cancelled'].includes(task.jobState || ''),
              )
              .map((task) => (
                <small key={`${task.hostId}:${task.jobId || task.idempotencyKey}`}>
                  {task.platform?.toUpperCase()} · {task.offline ? '离线' : task.jobState} ·{' '}
                  {task.progressInfo?._percent || 0}%
                </small>
              ))}
          </Button>
        </GameActions>
      ))}
    </div>
  )
})
export default CardList
