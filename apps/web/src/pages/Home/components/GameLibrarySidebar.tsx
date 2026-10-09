import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, Search } from 'react-feather'
import { Button, IconButton, Input } from '@/design-system'
import type { FileStat } from '@/types'
import { formatPkgName } from '@/utils'
import { pkgInfo } from '../pkgMetadata'
import { GameCover } from './GameCover'

export function GameLibrarySidebar({
  files,
  currentFilename,
  displayPkgRawTitle,
  onReturn,
  onSelect,
}: {
  files: FileStat[]
  currentFilename?: string
  displayPkgRawTitle: boolean
  onReturn: () => void
  onSelect: (file: FileStat) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const search = query.trim().toLocaleLowerCase()
  const visibleFiles = search
    ? files.filter((file) =>
        [
          formatPkgName(file, displayPkgRawTitle),
          pkgInfo(file).title,
          pkgInfo(file).titleId,
          pkgInfo(file).contentId,
          file.basename,
        ].some((value) => value?.toLocaleLowerCase().includes(search)),
      )
    : files

  useEffect(() => {
    if (!open || !list.current) return
    const active = list.current.querySelector<HTMLElement>('[data-current]')
    if (active)
      list.current.scrollTop =
        active.offsetTop - list.current.offsetTop - (list.current.clientHeight - active.clientHeight) / 2
  }, [open, currentFilename])

  return (
    <aside
      className="game-page-library-drawer"
      aria-label="游戏库快速浏览"
      data-open={open || undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false)
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) setOpen(false)
      }}
    >
      <button
        ref={handle}
        type="button"
        className="game-page-library-handle"
        aria-label="返回游戏库"
        onClick={onReturn}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        <span>游戏库</span>
      </button>
      {open && (
        <div className="game-page-library-panel">
          <div className="game-page-library-heading">
            <Button variant="text" className="game-page-library-title" aria-label="返回游戏库列表" onClick={onReturn}>
              游戏库 <span className="game-page-library-count">{files.length}</span>
            </Button>
            <IconButton
              label="收起游戏库侧边栏"
              variant="text"
              onClick={() => {
                handle.current?.focus()
                setOpen(false)
              }}
            >
              <ChevronLeft />
            </IconButton>
          </div>
          <Input
            className="game-page-library-search"
            aria-label="搜索侧边栏游戏"
            placeholder="搜索名称或游戏编号"
            prefix={<Search size={15} aria-hidden="true" />}
            value={query}
            onChange={(value) => {
              setQuery(value)
              if (list.current) list.current.scrollTop = 0
            }}
          />
          <div className="game-page-library-list" ref={list}>
            {visibleFiles.map((file) => {
              const current = file.filename === currentFilename
              const name = formatPkgName(file, displayPkgRawTitle)
              return (
                <Button
                  key={file.filename}
                  variant="text"
                  className="game-page-library-item"
                  data-current={current || undefined}
                  aria-current={current ? 'true' : undefined}
                  title={name}
                  onClick={() => {
                    if (!current) onSelect(file)
                  }}
                >
                  <span className="game-page-library-thumb">
                    <GameCover file={file} compact />
                  </span>
                  <span className="game-page-library-label">
                    <span className="game-page-library-name">{name}</span>
                    <span className="game-page-library-meta">{pkgInfo(file).titleId || pkgInfo(file).category}</span>
                  </span>
                  {current && <Check className="game-page-library-current" size={15} aria-hidden="true" />}
                </Button>
              )
            })}
            {!visibleFiles.length && <p className="game-page-library-empty">没有匹配的游戏</p>}
          </div>
        </div>
      )}
    </aside>
  )
}
