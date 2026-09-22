import { RouteSurface } from '@/components/RouteSurface'
import { throwIfAborted } from '@/utils/abort'
import { isPlayStationBrowser } from '@/utils/browser'
import { Tabs } from '@base-ui/react/tabs'
import { Dialog } from '@base-ui/react/dialog'
import { useReducedMotion } from 'framer-motion'
import { X, Download, Copy } from 'react-feather'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PkgListClickAction } from 'common/types/configStore'
import { Button, IconButton, Disclosure } from '@/design-system'
import { useContainer } from '@/store/container'
import type { FileStat } from '@/types'
import { formatFileSize, formatPkgName } from '@/utils'
import { GameCover } from './GameCover'
import { SimpleList } from './SimpleList'
import { PkgResourcePanel } from './PkgResourcePanel'
import { formatPkgCategory, formatSystemVersion } from '../pkgMetadata'
import { loadPkgResource, resourceKey } from '../pkgResources'
import './gameDetail.less'

export function GameDetailPage({ data, hasBackground }: { data?: FileStat; hasBackground: boolean }) {
  const { settings, handleInstall } = useContainer()
  const displayPkgRawTitle = settings.displayPkgRawTitle
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(true)
  const prefersReducedMotion = useReducedMotion()
  const reduceMotion = prefersReducedMotion || isPlayStationBrowser
  const [copyStatus, setCopyStatus] = useState('')
  const [tab, setTab] = useState<string | number>('info')
  const [art, setArt] = useState<{ key: string; url: string }>()
  const [showArt, setShowArt] = useState(false)
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  const scroll = useRef<HTMLDivElement>(null)
  const key = data ? resourceKey(data) : ''
  const artUrl = art?.key === key ? art.url : undefined
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
  const handleInstallByActionType = (file: FileStat, action: PkgListClickAction) => {
    if (action === PkgListClickAction.install) void handleInstall(file)
  }
  useEffect(() => {
    setTab('info')
    setCopyStatus('')
    setShowArt(false)
    scroll.current?.scrollTo(0, 0)
    if (!data) return
    const controller = new AbortController()
    const load = async () => {
      const entries = await loadPkgResource(data, 'artwork', controller.signal)
      const entry = entries.find((item) => /(^|[\\/])pic1\.png$/i.test(item.name))
      if (!entry || !data.downloadUrl) return
      const { getPs4PkgArtworkImage } = await import('@njzy/ps4-pkg-info/web')
      throwIfAborted(controller.signal)
      const result = await getPs4PkgArtworkImage(data.downloadUrl, entry.id, { signal: controller.signal })
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
  }, [key])
  const nestedSettings = location.pathname.startsWith('/settings')
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
          <div className="settings-close">
            <IconButton label="关闭游戏详情" variant="text" onClick={close}>
              <X />
            </IconButton>
            <small>ESC</small>
          </div>
          <RouteSurface
            className="game-page-scroll"
            ref={scroll}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: open ? 1 : 0, y: open || reduceMotion ? 0 : 6 }}
            transition={transition}
          >
            {!data ? (
              <div className="game-page-content">
                <p>未找到游戏信息，请返回游戏库重新打开。</p>
              </div>
            ) : (
              <>
                <section className="detail-hero">
                  <div className="detail-hero-fallback" aria-hidden="true">
                    {data.icon0 && <img src={data.icon0} alt="" />}
                  </div>
                  {artUrl && (
                    <img
                      className="detail-hero-art"
                      data-ready={showArt || undefined}
                      src={artUrl}
                      alt=""
                      onLoad={() => setShowArt(true)}
                    />
                  )}
                  <div className="detail-hero-shade" />
                  <div className="detail-hero-content">
                    <div className="detail-game-identity">
                      <div className="game-cover">
                        <GameCover file={data} />
                      </div>
                      <div className="detail-game-titles">
                        <div className="detail-identity-line">
                          <span>PS4</span>
                          <span>{formatPkgCategory(data.paramSfo?.CATEGORY)}</span>
                          {data.paramSfo?.TITLE_ID && (
                            <Button
                              variant="text"
                              className="detail-title-id"
                              icon={<Copy size={12} />}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(data.paramSfo!.TITLE_ID)
                                  setCopyStatus('已复制')
                                } catch {
                                  setCopyStatus('复制失败，请手动复制')
                                }
                              }}
                            >
                              {data.paramSfo.TITLE_ID}
                            </Button>
                          )}
                        </div>
                        <h1>{title}</h1>
                        {data.paramSfo?.TITLE && data.paramSfo.TITLE !== title && (
                          <p className="detail-original-title">{data.paramSfo.TITLE}</p>
                        )}
                        <div className="detail-facts">
                          <span>
                            游戏版本 <strong>{data.paramSfo?.APP_VER || '—'}</strong>
                          </span>
                          <span>
                            容量 <strong>{formatFileSize(data.size)}</strong>
                          </span>
                          <span>
                            最低系统 <strong>{formatSystemVersion(data.paramSfo?.SYSTEM_VER)}</strong>
                          </span>
                        </div>
                        <span className="detail-copy-status" role="status">
                          {copyStatus}
                        </span>
                      </div>
                    </div>
                    <Button
                      className="detail-install-button"
                      variant="primary"
                      icon={<Download size={18} />}
                      onClick={() => void handleInstall(data)}
                    >
                      安装到主机
                    </Button>
                  </div>
                </section>
                <div className="game-page-content">
                  <Tabs.Root className="game-detail-tabs" value={tab} onValueChange={setTab}>
                    <Tabs.List className="detail-tabs">
                      <Tabs.Tab value="info">游戏信息</Tabs.Tab>
                      <Tabs.Tab value="artwork">艺术图</Tabs.Tab>
                      <Tabs.Tab value="trophies">奖杯</Tabs.Tab>
                      {Boolean(data.patchs?.length) && <Tabs.Tab value="patch">补丁 ({data.patchs!.length})</Tabs.Tab>}
                      {Boolean(data.addons?.length) && <Tabs.Tab value="addon">DLC ({data.addons!.length})</Tabs.Tab>}
                    </Tabs.List>
                    <Tabs.Panel value="info">
                      <dl className="game-metadata">
                        <div>
                          <dt>游戏名称</dt>
                          <dd>{data.paramSfo?.TITLE || '—'}</dd>
                        </div>
                        <div>
                          <dt>游戏编号</dt>
                          <dd>
                            {data.paramSfo?.TITLE_ID || '—'}
                            {data.paramSfo?.TITLE_ID && (
                              <Button
                                className="metadata-copy"
                                variant="text"
                                aria-label="复制游戏编号"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(data.paramSfo!.TITLE_ID)
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
                          <dd>{data.paramSfo?.APP_VER || '—'}</dd>
                        </div>
                        <div>
                          <dt>内容类型</dt>
                          <dd>{formatPkgCategory(data.paramSfo?.CATEGORY)}</dd>
                        </div>
                        <div>
                          <dt>最低系统版本</dt>
                          <dd>{formatSystemVersion(data.paramSfo?.SYSTEM_VER)}</dd>
                        </div>
                        <div>
                          <dt>文件大小</dt>
                          <dd>{formatFileSize(data.size)}</dd>
                        </div>
                        <div>
                          <dt>包版本</dt>
                          <dd>{data.paramSfo?.VERSION || '—'}</dd>
                        </div>
                        <div>
                          <dt>内容编号</dt>
                          <dd>{data.paramSfo?.CONTENT_ID || '—'}</dd>
                        </div>
                        <div>
                          <dt>文件名</dt>
                          <dd>{data.basename}</dd>
                        </div>
                      </dl>
                      <Disclosure
                        className="game-metadata-raw"
                        key={data.filename}
                        defaultOpen
                        title="技术信息 · 原始 PARAM.SFO"
                      >
                        {Object.keys(data.paramSfo || {}).length ? (
                          <dl className="game-metadata">
                            {Object.entries(data.paramSfo || {}).map(([key, value]) => (
                              <div key={key}>
                                <dt>{key}</dt>
                                <dd>{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="muted">尚未读取到 PARAM.SFO 信息</p>
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
