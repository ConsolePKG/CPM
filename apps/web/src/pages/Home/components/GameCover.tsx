import { useEffect, useState } from 'react'
import { Folder, Package } from 'react-feather'
import type { FileStat } from '@/types'
import { libraryCover } from '@/library/runtime'
export function GameCover({ file, compact = false }: { file: FileStat; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [resolved, setResolved] = useState<string>()
  useEffect(() => setFailed(false), [file.icon0])
  useEffect(() => {
    let stopped = false
    let url: string | undefined
    setResolved(undefined)
    if (!file.icon0 && file.resourceId) {
      void libraryCover(file)
        .then((asset) => {
          if (stopped || !asset) return
          url = URL.createObjectURL(new Blob([Uint8Array.from(asset.bytes)], { type: asset.contentType }))
          setFailed(false)
          setResolved(url)
        })
        .catch(() => {})
    }
    return () => {
      stopped = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file.icon0, file.resourceId, file.libraryConnectionId, file.coverAssetId, file.fileVersion])
  const source = file.icon0 || resolved
  return source && !failed && file.type !== 'directory' ? (
    <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="game-cover-placeholder">
      {file.type === 'directory' ? <Folder size={32} aria-hidden="true" /> : <Package size={32} aria-hidden="true" />}
      {!compact && <span>{file.type === 'directory' ? '文件夹' : '暂无封面'}</span>}
    </div>
  )
}
