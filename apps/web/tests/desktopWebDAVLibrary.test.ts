import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core'

const mocks = rstest.hoisted(() => ({
  browser: rstest.fn(),
  publish: rstest.fn(),
  download: rstest.fn(),
  config: rstest.fn(),
  files: rstest.fn(),
  file: rstest.fn(),
  asset: rstest.fn(),
}))
rstest.mock('@consolepkg/library/browser', () => ({ createBrowserLibrary: mocks.browser, workerParser: rstest.fn() }))
rstest.mock('@/utils', () => ({ getInitConfigFromStore: mocks.config }))
rstest.mock('@consolepkg/library', () => ({
  RemoteLibraryClient: class {
    constructor(
      public baseUrl: string,
      public token: string,
    ) {}
    download = mocks.download
    listFiles = mocks.files
    getFile = mocks.file
    asset = mocks.asset
  },
}))

import {
  connectLibrary,
  disconnectLibrary,
  libraryCover,
  resolveLibraryFile,
  resourceDownload,
} from '../src/library/runtime'
import { FileServerType, type FileStat } from '../src/types'

const host = { id: 'private-dav', type: FileServerType.WebDAV, url: 'http://nas/dav' }

beforeEach(() => {
  rstest.resetAllMocks()
  rstest.stubGlobal('window', { electron: { createWebDAVLibrary: mocks.publish } })
  mocks.publish.mockResolvedValue({ url: 'http://desktop:54321', token: 'admin-token', libraryId: 'hosted-library' })
  mocks.config.mockReturnValue([host])
})
afterEach(() => {
  disconnectLibrary(host.id)
  disconnectLibrary('other-dav')
  rstest.unstubAllGlobals()
})

describe('Electron WebDAV library routing', () => {
  it('keeps desktop indexing and sends the direct authenticated WebDAV URL returned by the library', async () => {
    const connection = await connectLibrary(host)
    expect(connection.libraryId).toBe('hosted-library')
    expect(connection.client).toMatchObject({ baseUrl: 'http://desktop:54321', token: 'admin-token' })
    expect(mocks.publish).toHaveBeenCalledWith({ connectionId: host.id })
    expect(mocks.browser).not.toHaveBeenCalled()
    const url = 'http://user:secret@nas/dav/game.pkg'
    mocks.download.mockResolvedValue({ url, fileVersion: 'current' })
    expect(await resourceDownload({ resourceId: 'file', libraryConnectionId: host.id } as FileStat)).toBe(url)
    expect(mocks.download).toHaveBeenCalledWith('file')
  })

  it('reports hosted library startup failure without falling back to a browser-only connection', async () => {
    mocks.publish.mockResolvedValue({ errorMessage: 'Database unavailable' })
    await expect(connectLibrary(host)).rejects.toThrow('Database unavailable')
    expect(mocks.browser).not.toHaveBeenCalled()
  })
  it('recovers a task by Content ID plus known package type and loads its saved library cover', async () => {
    mocks.files.mockResolvedValue({
      items: [
        { id: 'wrong-file', available: true, name: 'Same title.pkg', metadata: { contentId: 'other-content' } },
        {
          id: 'patch-file',
          available: true,
          name: 'Persona update.pkg',
          metadata: { contentId: 'native-content', kind: 'patch' },
        },
        {
          id: 'original-file',
          available: true,
          name: 'Persona.pkg',
          size: 100,
          state: 'ready',
          coverId: 'cover',
          fileVersion: 'version',
          metadata: { contentId: 'native-content', platform: 'ps4', title: 'Persona', kind: 'base' },
        },
      ],
    })
    expect(await resolveLibraryFile(undefined, 'native-content')).toBeUndefined()
    const file = await resolveLibraryFile({ resourceKind: 'base' } as FileStat, 'native-content')
    expect(file).toMatchObject({
      resourceId: 'original-file',
      libraryConnectionId: host.id,
      coverAssetId: 'cover',
      fileVersion: 'version',
    })
    mocks.asset.mockResolvedValue({ bytes: new Uint8Array([137, 80]), contentType: 'image/png' })
    expect(await libraryCover(file!)).toMatchObject({ contentType: 'image/png' })
    expect(mocks.asset).toHaveBeenCalledWith('cover')
  })
  it('resolves the exact resource reference and does not replace a missing package with a same-content patch', async () => {
    mocks.file.mockResolvedValue({
      id: 'base-file',
      available: true,
      name: 'Persona.pkg',
      size: 100,
      state: 'ready',
      coverId: 'cover',
      metadata: { contentId: 'native-content', kind: 'base' },
    })
    expect(await resolveLibraryFile({ resourceId: 'base-file' } as FileStat, 'native-content')).toMatchObject({
      resourceId: 'base-file',
    })
    expect(mocks.file).toHaveBeenCalledWith('base-file')
    mocks.file.mockRejectedValue(new Error('File unavailable'))
    expect(await resolveLibraryFile({ resourceId: 'missing-file' } as FileStat, 'native-content')).toBeUndefined()
    expect(mocks.files).not.toHaveBeenCalled()
  })
  it('uses the originating library across selection and connection-ID changes, without matching another library file', async () => {
    const other = { ...host, id: 'other-dav' }
    mocks.config.mockReturnValue([other, host])
    mocks.publish.mockImplementation(async ({ connectionId }: { connectionId: string }) => ({
      url: 'http://desktop:54321',
      token: 'admin-token',
      libraryId: connectionId === host.id ? 'hosted-library' : 'other-library',
    }))
    mocks.file.mockResolvedValue({
      id: 'same-file-id',
      libraryId: 'hosted-library',
      available: true,
      name: 'Patch.pkg',
      size: 100,
      fileVersion: 'v1',
      metadata: { contentId: 'content', kind: 'patch' },
    })
    const reference = {
      resourceId: 'same-file-id',
      libraryId: 'hosted-library',
      libraryConnectionId: 'old-connection-id',
      fileVersion: 'v1',
    } as FileStat
    expect(await resolveLibraryFile(reference, 'content', true)).toMatchObject({
      libraryConnectionId: host.id,
      resourceKind: 'patch',
    })
    expect(mocks.file).toHaveBeenCalledTimes(1)
    mocks.config.mockReturnValue([other])
    expect(await resolveLibraryFile(reference, 'content', true)).toBeUndefined()
    expect(mocks.file).toHaveBeenCalledTimes(1)
    mocks.config.mockReturnValue([host])
    mocks.file.mockResolvedValue({
      id: 'same-file-id',
      libraryId: 'hosted-library',
      available: true,
      fileVersion: 'v2',
      metadata: { contentId: 'content' },
    })
    expect(await resolveLibraryFile(reference, 'content', true)).toBeUndefined()
  })
})
