import { PkgListClickAction } from 'common/types/configStore'
import type { FileStat } from '@/types'
import { Button, Empty, Spin } from '@/design-system'
import { formatFileSize, formatPkgName } from '@/utils'
import { GameActions } from './GameActions'
export type TableListProps = {
  handleInstallByActionType: (file: FileStat, action: PkgListClickAction) => void
  displayPkgRawTitle?: boolean
  loading?: boolean
  data: FileStat[]
}
export function TableList({ data, loading, displayPkgRawTitle, handleInstallByActionType }: TableListProps) {
  if (loading) return <Spin />
  if (!data.length) return <Empty description="没有找到符合条件的游戏" />
  return (
    <div className="file-table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th>文件名</th>
            <th>大小</th>
            <th>修改时间</th>
          </tr>
        </thead>
        <tbody>
          {data.map((file) => (
            <tr key={file.filename}>
              <td>
                <GameActions file={file} onAction={handleInstallByActionType}>
                  <Button variant="text" onClick={() => handleInstallByActionType(file, PkgListClickAction.auto)}>
                    {formatPkgName(file, displayPkgRawTitle)}
                  </Button>
                </GameActions>
              </td>
              <td>{file.type === 'directory' ? '文件夹' : formatFileSize(file.size)}</td>
              <td>{file.lastmod ? new Date(file.lastmod).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
