export const baseConvert = (num: string) => {
  return {
    from: function (radixFrom: number) {
      return {
        to: function (radixTo: number) {
          return parseInt(num, radixFrom).toString(radixTo)
        },
      }
    },
  }
}

export const le32 = function (bits: Buffer) {
  let result = 0
  let offset = 0
  for (let i = 0; i < 4; i++) {
    const byte = baseConvert(bits.slice(i, i + 1).toString('hex'))
      .from(16)
      .to(10)
    result |= Number(byte) << offset
    offset += 8
  }
  return result
}

export const le16 = function (bits: Buffer) {
  const byteA = baseConvert(bits.slice(0, 1).toString('hex')).from(16).to(10)
  const byteB = baseConvert(bits.slice(1, 2).toString('hex')).from(16).to(10)
  return Number(byteA) | (Number(byteB) << 8)
}
