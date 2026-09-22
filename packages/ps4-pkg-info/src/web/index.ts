import type { ExtractOptions, Ps4PkgInfo } from '../core'
import { extract } from '../core'
import { createResourceReader } from './resourceReader'

export * from '../types'

type Options = Pick<ExtractOptions, 'generateIcon0' | 'generateParamSfo'> & {
  /**
   * base64
   * @default false
   */
  generateBase64Icon?: boolean
}

export const getPs4PkgInfo = async (pkgFileUrl: string, options?: Options): Promise<Ps4PkgInfo | undefined> => {
  const { seekChunk, destroyAll } = createResourceReader(pkgFileUrl)
  let res: Ps4PkgInfo | undefined
  try {
    res = await extract({ seekChunk, ...options })
  } finally {
    destroyAll?.()
  }
  if (res?.icon0Raw && options?.generateBase64Icon) {
    res.icon0 = `data:image/png;base64,` + res.icon0Raw.toString('base64')
  }
  return res
}

export type {
  Artwork,
  ArtworkEntry,
  ArtworkImage,
  Resource,
  ResourceOptions,
  Trophy,
  TrophySet,
  TrophyLanguage,
} from '../resources'
export async function getPs4PkgArtwork(url: string, options?: import('../resources').ResourceOptions) {
  const [{ extractArtwork }, { createResourceReader }] = await Promise.all([
    import('../resources'),
    import('./resourceReader'),
  ])
  return extractArtwork(createResourceReader(url, options))
}
export async function getPs4PkgTrophies(url: string, options?: import('../resources').ResourceOptions) {
  const [{ extractTrophies }, { createResourceReader }] = await Promise.all([
    import('../resources'),
    import('./resourceReader'),
  ])
  return extractTrophies(createResourceReader(url, options), options?.language)
}

export async function getPs4PkgArtworkImage(url: string, id: number, options?: import('../resources').ResourceOptions) {
  const [{ extractArtworkImage }, { createResourceReader }] = await Promise.all([
    import('../resources'),
    import('./resourceReader'),
  ])
  return extractArtworkImage(createResourceReader(url, options), id)
}
