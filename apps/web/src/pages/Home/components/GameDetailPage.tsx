import { RouteSurface } from '@/components/RouteSurface'
import { AppHeader } from '@/components/shell/AppHeader'
import { throwIfAborted } from '@/utils/abort'
import { libraryResource } from '@/library/runtime'
import { isPlayStationBrowser } from '@/utils/browser'
import { Tabs } from '@base-ui/react/tabs'
import { Dialog } from '@base-ui/react/dialog'
import { useReducedMotion } from 'framer-motion'
import { X, Download, Copy } from 'react-feather'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { PkgListClickAction } from 'common/types/configStore'
import { Button, IconButton, Disclosure, Spin, Empty } from '@/design-system'
import { useContainer } from '@/store/container'
import type { GameLocationState } from '@/routes'
import type { FileStat } from '@/types'
import { formatFileSize, formatPkgName } from '@/utils'
import { GameCover } from './GameCover'
import { GameLibrarySidebar } from './GameLibrarySidebar'
import { HeroArtwork } from './HeroArtwork'
import { IconColorBackdrop } from './IconColorBackdrop'
import { SimpleList } from './SimpleList'
import { PkgResourcePanel } from './PkgResourcePanel'
import { pkgInfo } from '../pkgMetadata'
import { loadPkgResource, resourceKey } from '../pkgResources'
import { gameDetailPath, readGameReference } from '../gameDetailRoute'
import { useGameDetailFile } from '../useGameDetailFile'
import './gameDetail.less'

export function GameDetailPage({
  detailLocation,
  hasBackground,
}: {
  detailLocation: Location
  hasBackground: boolean
}) {
  const {
    settings,
    handleInstall,
    fileServer,
    ps4Installer: { isSendingInstall },
  } = useContainer()
  const displayPkgRawTitle = settings.displayPkgRawTitle
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = detailLocation.state as GameLocationState | null
  const { file: data, loading: loadingDetail } = useGameDetailFile(
    detailLocation.search,
    fileServer.fileServerFiles,
    locationState?.file,
    fileServer.loading || fileServer.pending,
  )
  const [open, setOpen] = useState(true)
  const prefersReducedMotion = useReducedMotion()
  const reduceMotion = prefersReducedMotion || isPlayStationBrowser
  const [copyStatus, setCopyStatus] = useState('')
  const [tab, setTab] = useState<string | number>('info')
  const [art, setArt] = useState<{ key: string; url: string }>()
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  const scroll = useRef<HTMLDivElement>(null)
  const key = data ? resourceKey(data) : ''
  const siblings = useMemo(() => {
    const files = new Map(fileServer.fileServerFiles.map((file) => [file.filename, file]))
    return (
      locationState?.detailOrder ||
      fileServer.fileServerFiles.filter((file) => file.type !== 'directory').map((file) => file.filename)
    ).flatMap((filename) => {
      const file = files.get(filename)
      return file ? [file] : []
    })
  }, [fileServer.fileServerFiles, locationState?.detailOrder])
  const siblingIndex = siblings.findIndex((file) => file.filename === data?.filename)
  const previousGame = siblingIndex > 0 ? siblings[siblingIndex - 1] : undefined
  const nextGame = siblingIndex >= 0 ? siblings[siblingIndex + 1] : undefined
  const info = pkgInfo(data)
  const isDlc = info.isDlc
  const artUrl = !isDlc && art?.key === key ? art.url : undefined
  const title = formatPkgName(data, displayPkgRawTitle)
  const transition = { duration: reduceMotion ? 0 : open ? 0.2 : 0.18, ease: [0.25, 0.1, 0.25, 1] as const }
  const close = () => {
    if (isPlayStationBrowser) finishClose()
    else setOpen(false)
  }
  const finishClose = () => {
    if (hasBackground) navigate(-1)
    else navigate('/', { replace: true })
  }
  const switchGame = (file: FileStat) => {
    navigate(gameDetailPath(file), { replace: true, state: { ...locationState, file } })
  }
  const handleInstallByActionType = (file: FileStat, action: PkgListClickAction) => {
    if (action === PkgListClickAction.install) void handleInstall(file)
  }
  useEffect(() => {
    const source = readGameReference(detailLocation.search)?.libraryConnectionId
    if (
      source &&
      source !== fileServer.curFileServerHostId &&
      fileServer.fileServerHosts.some((host) => host.id === source)
    )
      fileServer.setCurFileServerHostId(source)
  }, [detailLocation.search, fileServer.curFileServerHostId, fileServer.fileServerHosts])
  useEffect(() => {
    if (data && !readGameReference(detailLocation.search) && location.pathname === '/game')
      navigate(gameDetailPath(data), { replace: true, state: locationState })
  }, [data, detailLocation.search, location.pathname, locationState, navigate])
  useEffect(() => {
    setTab('info')
    setCopyStatus('')
    scroll.current?.scrollTo(0, 0)
    if (!data || isDlc) return
    const controller = new AbortController()
    const load = async () => {
      const entries = await loadPkgResource(data, 'artwork', controller.signal)
      const entry =
        entries.find((item) => /(^|[\\/])pic1\.png$/i.test(item.name)) ||
        entries.find((item) => /(^|[\\/])pic1\.dds$/i.test(item.name))
      if (!entry || (!data.downloadUrl && !data.resourceId)) return
      const { getPs4PkgArtworkImage } = await import('@njzy/ps4-pkg-info/web')
      throwIfAborted(controller.signal)
      const result: Awaited<ReturnType<typeof getPs4PkgArtworkImage>> = data.resourceId
        ? ((await libraryResource(data, 'artwork-image', String(entry.id))) as any)
        : await getPs4PkgArtworkImage(data.downloadUrl!, entry.id, { signal: controller.signal })
      if (result.status !== 'ready' || !result.data.preview) return
      const image = new Image()
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('艺术图加载失败'))
        image.src = result.data.url
      })
      if (!controller.signal.aborted) setArt({ key, url: result.data.url })
    }
    void load().catch(() => {
      /* Keep the cover backdrop when artwork is unavailable. */
    })
    return () => controller.abort()
  }, [key, isDlc, data?.icon0])
  const nestedSettings = location.pathname.startsWith('/settings')
  useEffect(() => {
    if (!window.electron || nestedSettings || !open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (
        (event.target as Element | null)?.closest(
          'input, textarea, select, [contenteditable="true"], [role="tablist"], [role="slider"], [role="menu"], [role="listbox"]',
        )
      )
        return
      const file = event.key === 'ArrowLeft' ? previousGame : nextGame
      if (!file) return
      event.preventDefault()
      switchGame(file)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [nestedSettings, nextGame, open, previousGame, locationState, navigate])
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next && !nestedSettings) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="game-page-backdrop">
          <RouteSurface
            className="game-page-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={transition}
          />
        </Dialog.Backdrop>
        <Dialog.Popup
          className="game-page"
          data-closing={!open || undefined}
          finalFocus={() => returnFocus.current}
          render={
            <RouteSurface
              initial={{ opacity: 0 }}
              animate={{ opacity: open ? 1 : 0 }}
              transition={transition}
              onAnimationComplete={() => {
                if (!open) finishClose()
              }}
            />
          }
        >
          <Dialog.Title className="game-page-title">{title || '游戏详情'}</Dialog.Title>
          {window.electron && (
            <div
              className={`game-page-header app-shell-desktop${window.electron.platform === 'darwin' ? ' app-shell-mac' : ''}`}
            >
              <AppHeader onClose={close} />
            </div>
          )}
          {window.electron && siblings.length > 0 && (
            <GameLibrarySidebar
              files={siblings}
              currentFilename={data?.filename}
              displayPkgRawTitle={displayPkgRawTitle}
              onReturn={close}
              onSelect={switchGame}
            />
          )}
          {!window.electron && (
            <div className="settings-close">
              <IconButton label="关闭游戏详情" variant="text" onClick={close}>
                <X />
              </IconButton>
              <small>ESC</small>
            </div>
          )}
          <RouteSurface
            className="game-page-scroll"
            ref={scroll}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: open ? 1 : 0, y: open || reduceMotion ? 0 : 6 }}
            transition={transition}
          >
            {!data ? (
              <div className="game-page-content">
                {loadingDetail ? (
                  <Spin tip="正在加载游戏信息…" />
                ) : (
                  <Empty description="游戏资源已移除或资源库暂时无法连接。">
                    <Button onClick={close}>返回游戏库</Button>
                  </Empty>
                )}
              </div>
            ) : (
              <>
                <section className={`detail-hero${isDlc ? ' detail-hero-compact' : ''}`}>
                  {isDlc && <IconColorBackdrop src={data.icon0} />}
                  {!isDlc && (
                    <div className="detail-hero-fallback" aria-hidden="true">
                      {data.icon0 && <img src={data.icon0} alt="" />}
                    </div>
                  )}
                  {artUrl && (
                    <HeroArtwork key={artUrl} src={artUrl} animate={!reduceMotion && open && !nestedSettings} />
                  )}
                  {!isDlc && <div className="detail-hero-shade" />}
                  <div className="detail-hero-content">
                    <div className="detail-game-identity">
                      <div className="game-cover">
                        <GameCover file={data} />
                      </div>
                      <div className="detail-game-titles">
                        <div className="detail-identity-line">
                          <span>{info.platform}</span>
                          <span>{info.category}</span>
                          {info.titleId && (
                            <Button
                              variant="text"
                              className="detail-title-id"
                              icon={<Copy size={12} />}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(info.titleId!)
                                  setCopyStatus('已复制')
                                } catch {
                                  setCopyStatus('复制失败，请手动复制')
                                }
                              }}
                            >
                              {info.titleId}
                            </Button>
                          )}
                        </div>
                        <h1>{title}</h1>
                        {info.title && info.title !== title && <p className="detail-original-title">{info.title}</p>}
                        <div className="detail-facts">
                          <span>
                            游戏版本 <strong>{info.version || '—'}</strong>
                          </span>
                          <span>
                            容量 <strong>{formatFileSize(data.size)}</strong>
                          </span>
                          <span>
                            最低系统 <strong>{info.systemVersion}</strong>
                          </span>
                        </div>
                        <span className="detail-copy-status" role="status">
                          {copyStatus}
                        </span>
                      </div>
                    </div>
                    <Button
                      disabled={Boolean(data.resourceId && !['ready', 'partial'].includes(data.parseState || ''))}
                      className="detail-install-button"
                      variant="primary"
                      icon={<Download size={18} />}
                      loading={isSendingInstall(data)}
                      onClick={() => void handleInstall(data)}
                    >
                      {isSendingInstall(data) ? '正在发送…' : '安装到主机'}
                    </Button>
                  </div>
                </section>
                <div className="game-page-content">
                  {data.parseMessage && (
                    <p className="pkg-resource-state" role="status">
                      {data.parseMessage}
                    </p>
                  )}
                  <Tabs.Root className="game-detail-tabs" value={tab} onValueChange={setTab}>
                    <Tabs.List className="detail-tabs">
                      <Tabs.Tab value="info">游戏信息</Tabs.Tab>
                      <Tabs.Tab value="artwork">艺术图</Tabs.Tab>
                      <Tabs.Tab value="trophies">奖杯</Tabs.Tab>
                      {Boolean(data.patchs?.length) && <Tabs.Tab value="patch">补丁 ({data.patchs!.length})</Tabs.Tab>}
                      {Boolean(data.addons?.length) && <Tabs.Tab value="addon">DLC ({data.addons!.length})</Tabs.Tab>}
                    </Tabs.List>
                    <Tabs.Panel value="info">
                      <dl className="game-metadata game-overview">
                        <div>
                          <dt>游戏名称</dt>
                          <dd>{info.title || '—'}</dd>
                        </div>
                        <div>
                          <dt>游戏编号</dt>
                          <dd>
                            {info.titleId || '—'}
                            {info.titleId && (
                              <Button
                                className="metadata-copy"
                                variant="text"
                                aria-label="复制游戏编号"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(info.titleId!)
                                    setCopyStatus('已复制')
                                  } catch {
                                    setCopyStatus('复制失败，请选中编号手动复制')
                                  }
                                }}
                              >
                                复制
                              </Button>
                            )}
                            <span className="metadata-copy-status" role="status">
                              {copyStatus}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>游戏版本</dt>
                          <dd>{info.version || '—'}</dd>
                        </div>
                        <div>
                          <dt>内容类型</dt>
                          <dd>{info.category}</dd>
                        </div>
                        <div>
                          <dt>最低系统版本</dt>
                          <dd>{info.systemVersion}</dd>
                        </div>
                        <div>
                          <dt>文件大小</dt>
                          <dd>{formatFileSize(data.size)}</dd>
                        </div>
                        <div>
                          <dt>包版本</dt>
                          <dd>{info.masterVersion || '—'}</dd>
                        </div>
                        <div className="game-overview-wide">
                          <dt>内容编号</dt>
                          <dd>{info.contentId || '—'}</dd>
                        </div>
                        <div className="game-overview-wide">
                          <dt>文件名</dt>
                          <dd>{data.basename}</dd>
                        </div>
                      </dl>
                      <Disclosure
                        className="game-metadata-raw"
                        key={data.filename}
                        title={`技术信息 · 原始 ${info.ps5 ? 'param.json' : 'PARAM.SFO'}`}
                      >
                        {Object.keys(info.raw).length ? (
                          <dl className="game-metadata">
                            {Object.entries(info.raw).map(([key, value]) => (
                              <div key={key}>
                                <dt>{key}</dt>
                                <dd>{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="muted">尚未读取到{info.ps5 ? ' param.json ' : ' PARAM.SFO '}信息</p>
                        )}
                      </Disclosure>
                    </Tabs.Panel>
                    <Tabs.Panel value="artwork">
                      <PkgResourcePanel file={data} kind="artwork" active={open && tab === 'artwork'} />
                    </Tabs.Panel>
                    <Tabs.Panel value="trophies">
                      <PkgResourcePanel file={data} kind="trophies" active={open && tab === 'trophies'} />
                    </Tabs.Panel>
                    <Tabs.Panel value="patch">
                      <SimpleList
                        fallbackCover={data.icon0}
                        data={data.patchs || []}
                        handleInstallByActionType={handleInstallByActionType}
                      />
                    </Tabs.Panel>
                    <Tabs.Panel value="addon">
                      <SimpleList
                        fallbackCover={data.icon0}
                        data={data.addons || []}
                        handleInstallByActionType={handleInstallByActionType}
                      />
                    </Tabs.Panel>
                  </Tabs.Root>
                </div>
              </>
            )}
          </RouteSurface>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
