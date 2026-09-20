/* eslint-disable @typescript-eslint/no-use-before-define */
import struct from 'python-struct'

import { Ps4PkgParamSfo } from './types'
import { le16, le32 } from './utils'

export type SeekChunk = (offset: number, whence?: number) => Promise<Buffer>
export type CustomSeek = { seekChunk: SeekChunk; destroyAll?: () => void }

export type ExtractOptions = CustomSeek & {
  /**
   * @default true
   */
  generateParamSfo?: boolean
  /**
   * @default true
   */
  generateIcon0?: boolean
}

export type Ps4PkgInfo = {
  paramSfo?: Ps4PkgParamSfo
  icon0Raw?: Buffer
  icon0?: string
}

export const extract = async ({
  seekChunk,
  destroyAll,
  generateIcon0 = true,
  generateParamSfo = true,
}: ExtractOptions): Promise<Ps4PkgInfo | undefined> => {
  if (!generateIcon0 && !generateParamSfo) {
    return
  }

  const baseChunk = await seekChunk(0x0, 0x1f)

  if (baseChunk.slice(0x0, 0x3 + 1).toString('utf-8') !== '\x7FCNT') {
    throw new Error('Invalid file format')
  }

  const totalTanleEntry = struct.unpack('>I', baseChunk.slice(0x10, 0x17 + 1))[0] as number
  const offsetTableEntry = struct.unpack('>I', baseChunk.slice(0x18, 0x1f + 1))[0] as number

  const { paramSfo, icon0 } = await getCustomTableEntryStruct({
    offset: offsetTableEntry,
    total: totalTanleEntry,
    generateIcon0,
    generateParamSfo,
    seekChunk,
  })

  const getParamSfo = async (): Promise<Ps4PkgParamSfo | undefined> => {
    if (!paramSfo) {
      return
    }
    const { offset, size } = paramSfo
    const chunk = await seekChunk(offset, offset + size)
    const paramSfoHeader = getParamSfoHeader(chunk.slice(0, size))
    const paramSfoLabels = chunk.slice(le32(paramSfoHeader.labelPtr), size)
    const paramSfoData = chunk.slice(le32(paramSfoHeader.dataPtr), size)

    const data = {} as Ps4PkgParamSfo

    let index = 20
    for (let i = 0; i < le32(paramSfoHeader.sectionTotal); i++) {
      const paramSfoSection = getParamSfoSection(chunk.slice(index, size))

      // eslint-disable-next-line prefer-destructuring
      const label = paramSfoLabels
        .toString('utf-8', le16(paramSfoSection.labelOffset), paramSfoLabels.length)
        .split('\u0000')[0]
      let value: string | number = ''

      switch (paramSfoSection.dataType) {
        case ParamSfoSectionDataType.string:
          value = paramSfoData.toString(
            'utf-8',
            le32(paramSfoSection.dataOffset),
            le32(paramSfoSection.dataOffset) + le32(paramSfoSection.usedDataField) - 1,
          )
          break
        case ParamSfoSectionDataType.integer:
          value = le32(
            paramSfoData.slice(
              le32(paramSfoSection.dataOffset),
              le32(paramSfoSection.dataOffset) + le32(paramSfoSection.usedDataField),
            ),
          )
          break
        default:
          break
      }
      data[label] = value
      index += 16
    }
    return data
  }

  const getIcon0 = async (): Promise<Buffer | undefined> => {
    if (!icon0) {
      return
    }
    const { offset, size } = icon0

    return await seekChunk(offset, offset + size)
  }

  const promises: any[] = []
  if (generateParamSfo) {
    promises.push(getParamSfo())
  }
  if (generateIcon0) {
    promises.push(getIcon0())
  }

  if (promises.length === 0) {
    return
  }

  const res = await Promise.all(promises)

  destroyAll?.()
  return {
    paramSfo: generateParamSfo ? res?.[0] : undefined,
    icon0Raw: !generateParamSfo ? res?.[0] : res?.[1],
  }
}

/** The file table is a list of file entries
 * @link https://www.psdevwiki.com/ps4/Package_Files
 */
type PkgTableEntryStruct = {
  /** uint32_t File ID, useful for files without a filename entry */
  id: number
  /** uint32_t Offset into the filenames table (ID 0x200) where this file's name is located */
  filename_offset: number
  /** uint32_t Flags including encrypted flag, etc */
  flags1: number
  /** uint32_t Flags including encryption key index, etc */
  flags2: number
  /** uint32_t Offset into PKG to find the file */
  offset: number
  /** uint32_t Size of the file */
  size: number
  /** uint64_t blank padding */
  padding?: number
}

type CustomTableEntryStruct = { paramSfo?: PkgTableEntryStruct; icon0?: PkgTableEntryStruct }

const getPkgTableEntrySturct = (chunk: Buffer): PkgTableEntryStruct => {
  const data = struct.unpack('>IIIIII8x', chunk) as number[]
  return {
    id: data[0],
    filename_offset: data[1],
    flags1: data[2],
    flags2: data[3],
    offset: data[4],
    size: data[5],
  }
}

type GetCustomTableEntryStructOptions = {
  offset: number
  total: number
  seekChunk: SeekChunk
} & Pick<ExtractOptions, 'generateIcon0' | 'generateParamSfo'>

const getCustomTableEntryStruct = async ({
  offset,
  total,
  generateIcon0,
  generateParamSfo,
  seekChunk,
}: GetCustomTableEntryStructOptions): Promise<CustomTableEntryStruct> => {
  const customTableEntryStruct: CustomTableEntryStruct = {}

  if (!generateParamSfo && !generateIcon0) {
    return customTableEntryStruct
  }

  const chunk = await seekChunk(offset, offset + total * 32)
  for (let i = 0; i < total; i++) {
    const slice = chunk.slice(i * 32, i * 32 + 32)
    const pkgTableEntryStruct = getPkgTableEntrySturct(slice)

    if (generateParamSfo && pkgTableEntryStruct.id === 0x1000) {
      customTableEntryStruct.paramSfo = pkgTableEntryStruct
      if (!generateIcon0) {
        break
      }
    }

    if (generateIcon0 && pkgTableEntryStruct.id === 0x1200) {
      customTableEntryStruct.icon0 = pkgTableEntryStruct
      if (!generateParamSfo) {
        break
      }
    }

    if (customTableEntryStruct.paramSfo && customTableEntryStruct.icon0) {
      break
    }
  }

  if (customTableEntryStruct.paramSfo || customTableEntryStruct.icon0) {
    return customTableEntryStruct
  } else {
    throw new Error('customTableEntryStruct is not found')
  }
}

type ParamSfoHeader = {
  data: Buffer
  magic: number
  rfu000: number
  labelPtr: Buffer
  dataPtr: Buffer
  sectionTotal: Buffer
}

const getParamSfoHeader = (chunk: Buffer): ParamSfoHeader => {
  return {
    data: chunk,
    magic: le32(chunk.slice(0, 4)),
    rfu000: le32(chunk.slice(4, 8)),
    labelPtr: chunk.slice(8, 12),
    dataPtr: chunk.slice(12, 16),
    sectionTotal: chunk.slice(16, 20),
  }
}

enum ParamSfoSectionDataType {
  binary = 0,
  string = 2,
  integer = 4,
}

type ParamSfoSection = {
  data: Buffer
  labelOffset: Buffer
  rfu001: Buffer
  dataType: ParamSfoSectionDataType
  usedDataField: Buffer
  sizeDataField: Buffer
  dataOffset: Buffer
}

const getParamSfoSection = (chunk: Buffer): ParamSfoSection => {
  return {
    data: chunk,
    labelOffset: chunk.slice(0, 2),
    rfu001: chunk.slice(2, 3),
    dataType: parseInt(chunk.toString('hex', 3, 4)),
    usedDataField: chunk.slice(4, 8),
    sizeDataField: chunk.slice(8, 12),
    dataOffset: chunk.slice(12, 16),
  }
}
