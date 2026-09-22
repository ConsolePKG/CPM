import { throwIfAborted } from '@/utils/abort'
import { useEffect, useRef, useState } from 'react'
import type { Artwork, ArtworkEntry, ArtworkImage, Resource, TrophyLanguage } from '@njzy/ps4-pkg-info/web'
import type { FileStat } from '@/types'
import { Button, Select } from '@/design-system'
import { TrophyBrowser, TrophySkeleton } from './TrophyBrowser'
import { loadPkgResource, resourceKey, type PkgResources, type ResourceKind } from '../pkgResources'

const imageBasename = (name: string) => name.split(/[\\/]/).pop() || name
const artworkPriority = (name: string) => {
  const basename = imageBasename(name)
  if (/^pic1(?:_\d+)?\.png$/i.test(basename)) return 0
  if (/^pic0(?:_\d+)?\.png$/i.test(basename)) return 1
  return 2
}
const artworkVariant = (name: string) => (/_\d+\.png$/i.test(imageBasename(name)) ? 1 : 0)
function ArtworkBrowser({
  file,
  artwork,
  active,
  prefix,
}: {
  file: FileStat
  artwork: Artwork
  active: boolean
  prefix: string
}) {
  const images = artwork
    .filter((entry) => /^pic.*\.png$/i.test(imageBasename(entry.name)))
    .sort(
      (a, b) =>
        artworkPriority(a.name) - artworkPriority(b.name) ||
        (artworkPriority(a.name) < 2 ? artworkVariant(a.name) - artworkVariant(b.name) : 0) ||
        imageBasename(a.name).localeCompare(imageBasename(b.name), 'en', { numeric: true, sensitivity: 'base' }) ||
        a.id - b.id,
    )
  if (!images.length) return <p className="pkg-resource-state">此 PKG 未包含可展示的艺术图</p>
  return (
    <div className="pkg-artwork-grid">
      {images.map((entry) => (
        <ArtworkCard key={entry.id} file={file} entry={entry} active={active} prefix={prefix} />
      ))}
    </div>
  )
}
function ArtworkCard({
  file,
  entry,
  active,
  prefix,
}: {
  file: FileStat
  entry: ArtworkEntry
  active: boolean
  prefix: string
}) {
  const container = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active || visible) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([item]) => {
        if (item.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [active, visible])
  const [attempt, setAttempt] = useState(0)
  const [image, setImage] = useState<Resource<ArtworkImage>>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!active || !visible) return
    const controller = new AbortController()
    setImage(undefined)
    setError(undefined)
    import('@njzy/ps4-pkg-info/web')
      .then(async (pkg) => {
        throwIfAborted(controller.signal)
        if (!file.downloadUrl) throw new Error('缺少 PKG 下载地址')
        return pkg.getPs4PkgArtworkImage(file.downloadUrl, entry.id, { signal: controller.signal })
      })
      .then(
        (value) => {
          if (!controller.signal.aborted) setImage(value)
        },
        (reason) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '图片读取失败')
        },
      )
    return () => controller.abort()
  }, [entry.id, visible, active, attempt, file.downloadUrl])
  return (
    <section ref={container}>
      <h3>{imageBasename(entry.name)}</h3>
      {!image && !error && <p role="status">{visible ? '正在读取图片…' : '滚动到此处加载图片'}</p>}
      {error && <p role="alert">{error}</p>}
      {image && image.status !== 'ready' && <p>{image.message}</p>}
      {(error || (image && image.status !== 'ready')) && (
        <Button onClick={() => setAttempt((n) => n + 1)}>重新读取图片</Button>
      )}
      {image?.status === 'ready' && (
        <>
          {image.data.preview ? <img src={image.data.url} alt={entry.name} /> : <p>DDS 暂不支持预览，可导出原图</p>}
          <a
            className="pkg-image-export"
            href={image.data.url}
            download={`${prefix}-${entry.id.toString(16)}-${(entry?.name.split(/[\\/]/).pop() || 'image').replace(/\.[^.]+$/, '')}.${image.data.extension}`}
          >
            导出 {image.data.extension.toUpperCase()}
          </a>
        </>
      )}
    </section>
  )
}
export function PkgResourcePanel({ file, kind, active }: { file: FileStat; kind: ResourceKind; active: boolean }) {
  const fileKey = resourceKey(file)
  const [selection, setSelection] = useState({ fileKey, language: 'default' })
  const language = selection.fileKey === fileKey ? selection.language : 'default'
  const [languages, setLanguages] = useState<{ fileKey: string; options: TrophyLanguage[] }>()
  const options = languages?.fileKey === fileKey ? languages.options : []
  const key = fileKey + kind + language
  const [state, setState] = useState<{ key: string; data?: PkgResources[ResourceKind]; error?: string }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    setState({ key })
    loadPkgResource(file, kind, controller.signal, language).then(
      (data) => {
        if (!controller.signal.aborted) {
          setState({ key, data })
          if ('status' in data && data.status === 'ready')
            setLanguages({ fileKey, options: data.data.availableLanguages || [] })
        }
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({ key, error: error instanceof Error ? error.message : '资源读取失败' })
      },
    )
    return () => controller.abort()
  }, [key, kind, active, attempt])
  const current = state?.key === key ? state : undefined
  const prefix = (file.paramSfo?.TITLE_ID || file.basename).replace(/[^\w.-]/g, '_')
  const renderContent = () => {
    if (current?.error)
      return (
        <div className="pkg-resource-state" role="alert">
          <p>{current.error}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>重新读取</Button>
        </div>
      )
    if (!current?.data && kind === 'trophies') return <TrophySkeleton />
    if (!current?.data)
      return (
        <p className="pkg-resource-state" role="status">
          正在读取{kind === 'artwork' ? '艺术图' : '奖杯信息'}…
        </p>
      )
    if (kind === 'artwork') {
      const artwork = current.data as PkgResources['artwork']
      return <ArtworkBrowser key={fileKey} file={file} artwork={artwork} active={active} prefix={prefix} />
    }
    const result = current.data as PkgResources['trophies']
    if (result.status !== 'ready') return <p className="pkg-resource-state">{result.message}</p>
    return <TrophyBrowser key={fileKey} data={result.data} prefix={prefix} retry={() => setAttempt((n) => n + 1)} />
  }
  return (
    <>
      {kind === 'trophies' && (
        <div className="trophy-panel-heading">
          <div>
            <h2>奖杯</h2>
            <p>浏览游戏奖杯及获取条件</p>
          </div>
          <div className="pkg-trophy-language">
            <span>奖杯语言</span>
            <Select
              label="奖杯语言"
              value={language}
              onChange={(value) => setSelection({ fileKey, language: value })}
              options={[
                { value: 'default', label: '默认语言' },
                ...options
                  .filter((option) => option.id !== 'default')
                  .map((option) => ({ value: option.id, label: option.label })),
              ]}
            />
          </div>
        </div>
      )}
      {renderContent()}
    </>
  )
}
