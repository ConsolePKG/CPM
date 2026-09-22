import { Buffer } from 'buffer'
import { sha256 } from '@noble/hashes/sha2.js'
import { cbc } from '@noble/ciphers/aes.js'

/** Standard FPKG passcode; verify ENTRY_KEYS before using any derived key. */
export function deriveVerifiedEntryKey(contentId: Buffer, keyTable: Buffer, index: number): Buffer | undefined {
  if (index < 0 || index > 6 || contentId.length !== 48 || keyTable.length < 256) return
  const cid = contentId.toString('ascii').split('\0')[0]
  if (!/^[A-Z]{2}\d{4}-[A-Z0-9]{9}_\d{2}-[A-Z0-9]{16}$/.test(cid)) return
  const padded = Buffer.alloc(48)
  padded.write(cid, 'ascii')
  const indexBytes = Buffer.alloc(4)
  indexBytes.writeUInt32BE(index)
  const key = Buffer.from(
    sha256(
      Buffer.concat([
        Buffer.from(sha256(indexBytes)),
        Buffer.from(sha256(padded)),
        Buffer.from('0'.repeat(32), 'ascii'),
      ]),
    ),
  )
  const digest = Buffer.from(sha256(key)).map((byte, i) => byte ^ key[i])
  return Buffer.from(digest).equals(keyTable.subarray(32 + index * 32, 64 + index * 32)) ? key : undefined
}

export function decryptPkgEntry(ciphertext: Buffer, rawEntry: Buffer, key: Buffer, logicalSize: number): Buffer {
  if (rawEntry.length !== 32 || ciphertext.length !== Math.ceil(logicalSize / 16) * 16)
    throw new Error('加密 PKG 条目大小无效')
  const material = sha256(Buffer.concat([rawEntry, key]))
  return Buffer.from(
    cbc(material.slice(16), material.slice(0, 16), { disablePadding: true }).decrypt(ciphertext),
  ).subarray(0, logicalSize)
}
