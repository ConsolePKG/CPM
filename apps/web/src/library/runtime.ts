import { RemoteLibraryClient, type GameEntry, type LibraryClient, type ResourceFile } from '@consolepkg/library'
import { createBrowserLibrary, workerParser } from '@consolepkg/library/browser'
import { FileServerType, type FileServerHost, type FileStat } from '@/types'
import { getInitConfigFromStore } from '@/utils'

type Connection = {
  client: LibraryClient
  libraryId: string
  sessionOnly: boolean
  revision?: number
  files: Map<string, ResourceFile>
  games?: GameEntry[]
  assets: Map<string, string>
  refresh?: Promise<void>
}
const clients = new Map<string, Connection>()
const connecting = new Map<string, Promise<Connection>>()
const generations = new Map<string, number>()
let browser: ReturnType<typeof createBrowserLibrary> | undefined
const runtime = () =>
  (browser ||= createBrowserLibrary({
    parser: workerParser(
      () => new Worker(new URL('../../../../packages/library/src/worker.ts', import.meta.url), { type: 'module' }),
    ),
  }))
export async function connectLibrary(host: FileServerHost) {
  const cached = clients.get(host.id)
  if (cached) return cached
  const pending = connecting.get(host.id)
  if (pending) return pending
  const generation = generations.get(host.id) || 0
  const work = openLibrary(host)
    .then((connection) => {
      if ((generations.get(host.id) || 0) !== generation) throw new Error('资源库配置已更新，请重新连接')
      clients.set(host.id, connection)
      return connection
    })
    .finally(() => {
      if (connecting.get(host.id) === work) connecting.delete(host.id)
    })
  connecting.set(host.id, work)
  return work
}
async function openLibrary(host: FileServerHost): Promise<Connection> {
  let client: LibraryClient
  let libraryId: string
  let sessionOnly = false
  if (host.type === FileServerType.WebDAV || host.type === FileServerType.BrowserFiles) {
    const local = await runtime()
    sessionOnly = local.sessionOnly
    client = local.engine
    if (!local.files.has(host.id)) local.files.set(host.id, new Map())
    const existing = (await client.listLibraries()).find((library) =>
      library.sources.some((source) => source.id === host.id),
    )
    const options = host.type === FileServerType.WebDAV ? host.options : undefined
    const config = {
      id: host.id,
      name: host.alias || host.url || 'Files',
      type: host.type === FileServerType.WebDAV ? ('webdav' as const) : ('browser-files' as const),
      url: host.url,
      username: String(options?.username || ''),
      password: String(options?.password || ''),
    }
    if (
      existing &&
      JSON.stringify(existing.sources.find((source) => source.id === host.id)) !== JSON.stringify(config)
    ) {
      await local.engine.idle()
      await client.updateSource(existing.id, config)
    }
    const library = existing || (await client.createLibrary(host.alias || 'Browser library', [config]))
    libraryId = library.id
    if (host.type === FileServerType.BrowserFiles) {
      const files = await new Promise<File[]>((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        input.accept = '.pkg,.nsp,.xci,.cia,.3ds'
        input.setAttribute('webkitdirectory', '')
        input.onchange = () => resolve(Array.from(input.files || []))
        input.oncancel = () => resolve([])
        input.click()
      })
      if (files.length) {
        const target = local.files.get(host.id)!
        target.clear()
        for (const file of files) target.set(file.webkitRelativePath || file.name, file)
      }
    }
    await client.scan(libraryId)
  } else {
    client = new RemoteLibraryClient(host.url, host.token)
    const libraries = await client.listLibraries()
    if (host.provision) {
      if (!(await client.capabilities()).writable)
        throw new Error('创建自己的资源库需要管理员权限，不能使用只读分享令牌')
      const existing = libraries.find((library) => library.sources.some((source) => source.id === host.provision!.id))
      if (existing) {
        libraryId = existing.id
        const source = existing.sources.find((source) => source.id === host.provision!.id)
        if (JSON.stringify(source) !== JSON.stringify(host.provision))
          await client.updateSource(existing.id, host.provision)
      } else {
        const created = await client.createLibrary(host.alias || 'Games', [host.provision])
        libraries.push(created)
        libraryId = created.id
      }
      await client.scan(libraryId!)
    }
    libraryId = libraryId! || host.libraryId || libraries[0]?.id
    if (!libraryId) throw new Error('资源库服务尚未创建资源库，请使用管理员配置来源')
  }
  return { client, libraryId, sessionOnly, files: new Map(), assets: new Map() }
}
export function disconnectLibrary(id: string) {
  for (const url of clients.get(id)?.assets.values() || []) URL.revokeObjectURL(url)
  clients.delete(id)
  connecting.delete(id)
  generations.set(id, (generations.get(id) || 0) + 1)
}
export async function resourceDownload(file: FileStat) {
  if (!file.resourceId || !file.libraryConnectionId) return file.downloadUrl
  const connection = clients.get(file.libraryConnectionId)
  if (!connection) throw new Error('请重新连接资源库')
  const download = await connection.client.download(file.resourceId)
  if (!download.url) throw new Error(download.unavailable || '文件没有主机可访问的下载地址')
  return download.url
}
export async function libraryResource(file: FileStat, kind: string, key?: string) {
  const connection = clients.get(file.libraryConnectionId || '')
  if (!connection || !file.resourceId) throw new Error('请重新连接资源库')
  return connection.client.resource(file.resourceId, kind, key)
}
export async function libraryCover(file: FileStat) {
  if (!file.resourceId || !file.libraryConnectionId) return undefined
  let client = clients.get(file.libraryConnectionId)?.client
  if (!client) {
    const host = (getInitConfigFromStore('fileServerHosts', []) as FileServerHost[]).find(
      (host) => host.id === file.libraryConnectionId,
    )
    if (!host) return undefined
    client =
      host.type === FileServerType.BrowserFiles || host.type === FileServerType.WebDAV
        ? (await runtime()).engine
        : new RemoteLibraryClient(host.url, host.token)
  }
  const coverId = file.coverAssetId || (await client.getFile(file.resourceId)).coverId
  return coverId ? client.asset(coverId) : undefined
}
export async function libraryPresentation(connectionId: string, aggregation: boolean) {
  const connection = clients.get(connectionId)!
  const { client, libraryId } = connection
  if (!connection.refresh)
    connection.refresh = (async () => {
      let changed = false
      if (connection.revision !== undefined) {
        const changes = await client.changes(libraryId, connection.revision)
        if (changes.reset) {
          connection.files.clear()
          connection.revision = undefined
        } else {
          for (const file of changes.files) connection.files.set(file.id, file)
          changed = changes.files.length > 0
          connection.revision = changes.revision
        }
      }
      if (connection.revision === undefined) {
        let cursor: string | undefined
        do {
          const page = await client.listFiles(libraryId, { cursor, limit: 200 })
          for (const file of page.items) connection.files.set(file.id, file)
          connection.revision ??= page.revision
          cursor = page.nextCursor
        } while (cursor)
        changed = true
      }
      if (changed || !connection.games) {
        const games: GameEntry[] = []
        let cursor: string | undefined
        do {
          const page = await client.listGames(libraryId, { cursor, limit: 200 })
          games.push(...page.items)
          cursor = page.nextCursor
        } while (cursor)
        connection.games = games
      }
    })().finally(() => {
      connection.refresh = undefined
    })
  await connection.refresh
  const visible = [...connection.files.values()].filter((file) => file.available)
  const currentAssets = new Set(visible.map((file) => file.coverId))
  for (const [assetId, url] of connection.assets)
    if (!currentAssets.has(assetId)) {
      URL.revokeObjectURL(url)
      connection.assets.delete(assetId)
    }
  const presentation = new Map<string, FileStat>()
  for (const file of visible) {
    let icon0: string | undefined
    if (file.coverId) {
      icon0 = connection.assets.get(file.coverId)
      if (!icon0) {
        try {
          const asset = await client.asset(file.coverId)
          icon0 = URL.createObjectURL(new Blob([Uint8Array.from(asset.bytes)], { type: asset.contentType }))
          connection.assets.set(file.coverId, icon0)
        } catch {}
      }
    }
    presentation.set(file.id, {
      filename: file.path || file.id,
      basename: file.name,
      size: file.size,
      type: 'file',
      lastmod: file.modified || '',
      etag: file.etag || '',
      resourceId: file.id,
      libraryId,
      libraryConnectionId: connectionId,
      resourcePlatform: file.metadata?.platform,
      resourceKind: file.metadata?.kind,
      parseState: file.state,
      resourceMetadata: file.metadata,
      fileVersion: file.fileVersion,
      coverAssetId: file.coverId,
      parseMessage: file.message,
      paramSfo: file.metadata?.platform === 'ps4' ? (file.metadata.raw as any) : undefined,
      icon0,
    })
  }
  if (!aggregation) return [...presentation.values()]
  return connection
    .games!.flatMap((game) =>
      game.base.length
        ? game.base.map((id) => ({
            ...presentation.get(id)!,
            addons: game.dlcs.map((id) => presentation.get(id)!).filter(Boolean),
            patchs: game.patches.map((id) => presentation.get(id)!).filter(Boolean),
          }))
        : [...game.patches, ...game.dlcs, ...game.unknown].map((id) => presentation.get(id)!),
    )
    .filter((file) => file?.resourceId)
}
export async function retryLibraryFile(file: FileStat) {
  const connection = clients.get(file.libraryConnectionId || '')
  if (!connection || !file.resourceId) throw new Error('请重新连接资源库')
  if (!(await connection.client.capabilities()).writable) throw new Error('只读资源库不能重试解析，请联系库管理员')
  await connection.client.retry(file.resourceId)
}
export async function shareLibrary(host: FileServerHost) {
  const connection = await connectLibrary(host)
  if (!(connection.client instanceof RemoteLibraryClient) || !(await connection.client.capabilities()).writable)
    throw new Error('只有自己托管的资源库服务可以分享')
  const share = await connection.client.createShare(connection.libraryId)
  return {
    ...share,
    url: `${connection.client.baseUrl}/#token=${encodeURIComponent(share.token)}`,
    client: connection.client,
  }
}
export async function listLibraryShares(host: FileServerHost) {
  const connection = await connectLibrary(host)
  if (!(connection.client instanceof RemoteLibraryClient) || !(await connection.client.capabilities()).writable)
    throw new Error('管理员权限及资源库服务才能管理分享')
  return {
    client: connection.client,
    shares: (await connection.client.listShares(connection.libraryId)) as { id: string; revoked: boolean }[],
  }
}
