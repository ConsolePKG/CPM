import { Buffer } from 'buffer'

export function packageFixture(category = 'gd', titleId = 'CUSA12345') {
  const fields = {
    TITLE: 'Fixture game',
    TITLE_ID: titleId,
    CONTENT_ID: `UP0001-${titleId}_00-ABCDEFGHIJKLMNOP`,
    CATEGORY: category,
    APP_VER: '01.00',
  }
  const labels = Buffer.from(Object.keys(fields).join('\0') + '\0')
  const values = Object.values(fields).map((value) => Buffer.from(value + '\0'))
  const keys = Object.keys(fields)
  const labelOffset = 20 + keys.length * 16
  const dataOffset = labelOffset + labels.length
  const sfo = Buffer.alloc(dataOffset + values.reduce((size, value) => size + value.length, 0))
  sfo.writeUInt32LE(0x46535000, 0)
  sfo.writeUInt32LE(labelOffset, 8)
  sfo.writeUInt32LE(dataOffset, 12)
  sfo.writeUInt32LE(keys.length, 16)
  let label = 0
  let data = 0
  keys.forEach((key, index) => {
    const entry = 20 + index * 16
    sfo.writeUInt16LE(label, entry)
    sfo[entry + 3] = 2
    sfo.writeUInt32LE(values[index].length, entry + 4)
    sfo.writeUInt32LE(values[index].length, entry + 8)
    sfo.writeUInt32LE(data, entry + 12)
    values[index].copy(sfo, dataOffset + data)
    label += key.length + 1
    data += values[index].length
  })
  labels.copy(sfo, labelOffset)
  const icon = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',
    'base64',
  )
  const bytes = Buffer.alloc(96 + sfo.length + icon.length)
  bytes.writeUInt32BE(0x7f434e54, 0)
  bytes.writeUInt32BE(2, 16)
  bytes.writeUInt32BE(32, 24)
  bytes.writeUInt32BE(0x1000, 32)
  bytes.writeUInt32BE(96, 48)
  bytes.writeUInt32BE(sfo.length, 52)
  bytes.writeUInt32BE(0x1200, 64)
  bytes.writeUInt32BE(96 + sfo.length, 80)
  bytes.writeUInt32BE(icon.length, 84)
  sfo.copy(bytes, 96)
  icon.copy(bytes, 96 + sfo.length)
  return bytes
}
