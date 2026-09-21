import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cpi = resolve(root, '../CPI')
const source = resolve(process.argv[2] || resolve(cpi, 'rpi-payload-ps4.elf'))
const bytes = readFileSync(source)
if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) throw new Error('Not an ELF payload')
const version = /#define RPI_VERSION "([^"]+)"/.exec(readFileSync(resolve(cpi, 'include/rpi/types.h'), 'utf8'))?.[1]
if (!version) throw new Error('CPI version not found')
const target = resolve(root, 'apps/web/public/cpi')
mkdirSync(target, { recursive: true })
copyFileSync(source, resolve(target, 'rpi-payload-ps4.elf'))
writeFileSync(
  resolve(target, 'manifest.json'),
  JSON.stringify(
    {
      version,
      filename: 'rpi-payload-ps4.elf',
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  ) + '\n',
)
console.log(`Bundled CPI ${version}, ${bytes.length} bytes`)
