import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cpi = resolve(root, '../CPI')
const source = resolve(process.argv[2] || resolve(cpi, 'rpi-payload-ps4.elf'))
const filename = source.endsWith('rpi-payload-ps5.elf') ? 'rpi-payload-ps5.elf' : 'rpi-payload-ps4.elf'
const bytes = readFileSync(source)
if (!bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) throw new Error('Not an ELF payload')
const version = /#define RPI_VERSION "([^"]+)"/.exec(readFileSync(resolve(cpi, 'include/rpi/types.h'), 'utf8'))?.[1]
if (!version) throw new Error('CPI version not found')
if (!bytes.includes(Buffer.from(version)) || !bytes.includes(Buffer.from('/api/v1/capabilities')))
  throw new Error('Payload does not contain the current CPI version and v1 protocol; rebuild it before syncing')
const target = resolve(root, 'apps/web/public/cpi')
mkdirSync(target, { recursive: true })
copyFileSync(source, resolve(target, filename))
writeFileSync(
  resolve(target, filename === 'rpi-payload-ps5.elf' ? 'manifest-ps5.json' : 'manifest.json'),
  JSON.stringify(
    {
      version,
      protocolVersion: 1,
      filename,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  ) + '\n',
)
console.log(`Bundled CPI ${version}, ${bytes.length} bytes`)
