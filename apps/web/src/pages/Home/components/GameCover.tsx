import { useEffect, useState } from 'react'
import { Folder, Package } from 'react-feather'
import type { FileStat } from '@/types'
import { libraryCover } from '@/library/runtime'
export function GameCover({ file, platform = 'ps4' }: { file: FileStat; platform?: 'ps4' | 'ps5' }) {
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
      {file.type === 'directory' ? <Folder size={48} /> : <Package size={48} />}
      <span>
        {file.type === 'directory'
          ? '文件夹'
          : (file.resourcePlatform || platform) === 'ps5'
            ? 'PLAYSTATION 5'
            : (file.resourcePlatform || platform) === 'ps4'
              ? 'PLAYSTATION 4'
              : '未验证的格式'}
      </span>
    </div>
  )
}
