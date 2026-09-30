import { LibraryError, type ByteReader, type PackageParser } from './types'

export type ParserPlugin = { name: string; parser: PackageParser; identify: (header: Uint8Array) => boolean }
export function parserRegistry(plugins: ParserPlugin[]): PackageParser {
  const select = async (reader: ByteReader) => {
    const header = await reader.readRange(0, 4)
    return plugins.find((plugin) => plugin.identify(header))
  }
  return {
    version: plugins.map((plugin) => `${plugin.name}:${plugin.parser.version}`).join('|'),
    parse: async (reader, signal) => {
      const plugin = await select(reader)
      return plugin
        ? plugin.parser.parse(reader, signal)
        : {
            state: 'unsupported',
            metadata: { platform: 'unknown', format: 'unknown', kind: 'unknown', raw: {} },
            message: 'No verified parser registered for this format',
          }
    },
    asset: async (reader, kind, key) => {
      const plugin = await select(reader)
      if (!plugin?.parser.asset) throw new LibraryError('unsupported_asset', 'No verified extractor available')
      return plugin.parser.asset(reader, kind, key)
    },
  }
}
