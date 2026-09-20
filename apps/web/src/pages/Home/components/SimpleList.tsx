import { PkgListClickAction } from 'common/types/configStore'
import { Button, Empty } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
import type { TableListProps } from './TableList'
export function SimpleList({ data, handleInstallByActionType }: TableListProps) {
  return data.length ? (
    <div className="related-packages">
      {data.map((file) => (
        <div key={file.filename}>
          <div>
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
