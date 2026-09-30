import { useState } from 'react'
import { Folder, Package } from 'react-feather'
import type { FileStat } from '@/types'
export function GameCover({ file, platform = 'ps4' }: { file: FileStat; platform?: 'ps4' | 'ps5' }) {
  const [failed, setFailed] = useState(false)
  return file.icon0 && !failed && file.type !== 'directory' ? (
    <img src={file.icon0} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="game-cover-placeholder">
      {file.type === 'directory' ? <Folder size={48} /> : <Package size={48} />}
      <span>{file.type === 'directory' ? '文件夹' : platform === 'ps5' ? 'PLAYSTATION 5' : 'PLAYSTATION 4'}</span>
    </div>
  )
}
