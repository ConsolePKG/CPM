import type { OutputConfig, RsbuildConfig, RsbuildEntry } from '@rsbuild/core'
import { pluginLess, type PluginLessOptions } from '@rsbuild/plugin-less'
import { pluginReact, type PluginReactOptions } from '@rsbuild/plugin-react'
import { pluginSourceBuild, type PluginSourceBuildOptions } from '@rsbuild/plugin-source-build'
import { globSync } from 'glob'
import path from 'node:path'
import { pluginDevtoolsJson } from 'rsbuild-plugin-devtools-json'

export type RsSharedTarget = 'rsbuild' | 'rslib' | 'rstest'
type SourceConfig = NonNullable<RsbuildConfig['source']>

export type RsSharedOptions = {
  entry?: RsbuildEntry
  transformImport?: SourceConfig['transformImport']
  sourceBuild?: boolean
  sourceField?: string
  enablePersistentCache?: boolean
  externals?: OutputConfig['externals']
  pluginOptions?: {
    react?: Partial<PluginReactOptions>
    less?: Partial<PluginLessOptions>
    sourceBuild?: Partial<PluginSourceBuildOptions>
  }
}

const getDefaultEntryPattern = (target: RsSharedTarget) =>
  target === 'rsbuild' ? './src/{dev,index}.{ts,js,tsx,jsx,mjs,cjs}' : './src/index.{ts,js,tsx,jsx,mjs,cjs}'

const getEntry = (target: RsSharedTarget, entry?: RsbuildEntry): RsbuildConfig['source'] => {
  if (target === 'rstest') return {}
  const entryMatchedFiles = entry ? [] : globSync(getDefaultEntryPattern(target), { cwd: process.cwd() })
  return { entry: entry ?? { index: `./${entryMatchedFiles[0]}` } }
}

export const getRsSharedConfig = (target: RsSharedTarget, options: RsSharedOptions = {}): RsbuildConfig => {
  const proxyTarget = process.env.PROXY_TARGET
  const isRsbuild = target === 'rsbuild'
  const {
    entry,
    sourceBuild = true,
    sourceField = 'source',
    enablePersistentCache = true,
    externals,
    pluginOptions = {},
    transformImport,
  } = options

  const config: RsbuildConfig = {
    source: { define: {}, ...getEntry(target, entry), transformImport },
    output: {
      target: 'web',
      distPath: { root: 'dist', jsAsync: 'js-async', cssAsync: 'css-async' },
      legalComments: 'none',
      sourceMap: isRsbuild ? undefined : false,
      cssModules: { auto: true },
      minify: isRsbuild ? undefined : false,
      externals,
    },
    performance: { printFileSize: isRsbuild },
    plugins: [
      isRsbuild && pluginDevtoolsJson(),
      pluginReact(pluginOptions.react),
      pluginLess(pluginOptions.less),
      sourceBuild && pluginSourceBuild({ sourceField, ...pluginOptions.sourceBuild }),
    ].filter(Boolean),
    tools: {
      rspack: (rspackConfig, { addRules }) => {
        rspackConfig.module ??= {}
        rspackConfig.module.parser ??= {}
        rspackConfig.module.parser.javascript ??= {}
        rspackConfig.module.parser.javascript.typeReexportsPresence = 'tolerant'
        addRules({ resourceQuery: /raw/, type: 'asset/source' })
        rspackConfig.cache = enablePersistentCache ? { type: 'persistent' } : false
        return rspackConfig
      },
    },
  }

  if (target === 'rsbuild') {
    config.server = { historyApiFallback: true, port: Number(process.env.RENDERER_DEV_PORT || 5173) }
    if (proxyTarget) config.server.proxy = [{ pathFilter: ['/api'], target: proxyTarget }]
    config.dev = { watchFiles: [{ type: 'reload-server', paths: path.join(__dirname, '../**/*') }] }
  }
  return config
}
