import { decodeBC1, decodeBC2, decodeBC3 } from 'tex-decoder/build/esm/dxt.js'
import { decodeBC4, decodeBC5 } from 'tex-decoder/build/esm/atc.js'
import { decodeBC7 } from 'tex-decoder/build/esm/bc7.js'
import { makePNG } from 'tex-decoder/build/esm/png_maker.js'
import { Buffer } from 'buffer'
import { LibraryError } from './types'

export const isPng = (bytes: Uint8Array) =>
  bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)

/** Decode only the first 2D mip; bound allocations before passing data to texture decoders. */
export function ddsToPng(bytes: Uint8Array): Uint8Array {
  const data = Buffer.from(bytes)
  const invalid = () => new LibraryError('invalid_image', 'DDS 图片头部、尺寸或数据无效')
  if (
    data.length < 128 ||
    data.toString('ascii', 0, 4) !== 'DDS ' ||
    data.readUInt32LE(4) !== 124 ||
    data.readUInt32LE(76) !== 32
  )
    throw invalid()
  const width = data.readUInt32LE(16),
    height = data.readUInt32LE(12)
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16 * 1024 * 1024 ||
    data.readUInt32LE(112) & 0x200200
  )
    throw invalid()
  let start = 128
  const fourCC = data.toString('ascii', 84, 88)
  let format = ({ DXT1: 71, DXT3: 74, DXT5: 77, ATI1: 80, BC4U: 80, ATI2: 83, BC5U: 83 } as Record<string, number>)[
    fourCC
  ]
  if (fourCC === 'DX10') {
    if (data.length < 148 || data.readUInt32LE(132) !== 3 || data.readUInt32LE(136) & 4 || data.readUInt32LE(140) !== 1)
      throw invalid()
    format = data.readUInt32LE(128)
    start = 148
  }
  const decoders: Record<number, [typeof decodeBC7, number]> = {
    71: [decodeBC1, 8],
    72: [decodeBC1, 8],
    74: [decodeBC2, 16],
    75: [decodeBC2, 16],
    77: [decodeBC3, 16],
    78: [decodeBC3, 16],
    80: [decodeBC4, 8],
    83: [decodeBC5, 16],
    98: [decodeBC7, 16],
    99: [decodeBC7, 16],
  }
  let rgba: Uint8Array
  if (format === 28 || format === 29 || format === 87 || format === 91) {
    const length = width * height * 4
    if (start + length > data.length) throw invalid()
    rgba = Uint8Array.from(data.subarray(start, start + length))
    if (format === 87 || format === 91)
      for (let p = 0; p < length; p += 4) [rgba[p], rgba[p + 2]] = [rgba[p + 2], rgba[p]]
  } else {
    const decoder = decoders[format]
    if (!decoder)
      throw new LibraryError('unsupported_image', `暂不支持 DDS 格式 ${fourCC === 'DX10' ? format : fourCC}`)
    const length = Math.ceil(width / 4) * Math.ceil(height / 4) * decoder[1]
    if (start + length > data.length) throw invalid()
    rgba = decoder[0](Uint8Array.from(data.subarray(start, start + length)), width, height)
  }
  if (rgba.length !== width * height * 4) throw invalid()
  return Uint8Array.from(makePNG(rgba, width, height))
}
