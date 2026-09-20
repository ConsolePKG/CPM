import { PkgListClickAction } from 'common/types/configStore'
import { Button, Empty, Spin } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
import { useContainer } from '@/store/container'
import type { TableListProps } from './TableList'
import { GameCover } from './GameCover'
import { GameActions } from './GameActions'
export function CardList({ data, loading, displayPkgRawTitle, handleInstallByActionType }: TableListProps) {
  const { settings } = useContainer()
  if (loading) return <Spin />
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
                  : settings.pkgListClickAction === PkgListClickAction.install
                    ? '安装游戏'
                    : '查看详情'}
              </span>
            </div>
            <strong title={formatPkgName(file, displayPkgRawTitle)}>{formatPkgName(file, displayPkgRawTitle)}</strong>
            <small>{file.type === 'directory' ? '文件夹' : `PS4 · ${formatFileSize(file.size)}`}</small>
          </Button>
        </GameActions>
      ))}
    </div>
  )
}
export default CardList
