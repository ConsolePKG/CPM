import { PkgListClickAction } from 'common/types/configStore'
import { Button, Empty } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
import type { TableListProps } from './TableList'
import { GameCover } from './GameCover'
export function SimpleList({
  data,
  handleInstallByActionType,
  fallbackCover,
}: TableListProps & { fallbackCover?: string }) {
  return data.length ? (
    <div className="related-packages">
      {data.map((file) => (
        <div key={file.filename}>
          <div className="game-cover related-package-cover">
            <GameCover file={{ ...file, icon0: file.icon0 || fallbackCover }} />
          </div>
          <div className="related-package-info">
            <strong>{formatPkgName(file, true)}</strong>
            <small>
              {file.paramSfo?.APP_VER || file.paramSfo?.VERSION || '—'} · {formatFileSize(file.size)}
            </small>
            <small>{file.paramSfo?.CONTENT_ID}</small>
          </div>
          <Button onClick={() => handleInstallByActionType(file, PkgListClickAction.install)}>安装</Button>
        </div>
      ))}
    </div>
  ) : (
    <Empty />
  )
}
