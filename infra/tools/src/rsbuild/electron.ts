import { defineConfig, mergeRsbuildConfig, type RsbuildConfig } from '@rsbuild/core'
import path from 'node:path'

export type ElectronRsbuildOptions = Partial<RsbuildConfig> & {
  entry?: Record<string, string>
  distPath?: string
}

export const defineElectronConfig = (options: ElectronRsbuildOptions = {}) => {
  const {
    entry = { index: './src/index.ts', preload: './src/preload.ts' },
    distPath = 'dist/main',
    ...custom
  } = options
  return defineConfig(
    mergeRsbuildConfig(
      {
        source: { entry },
        output: {
          target: 'node',
          distPath: { root: distPath },
          filename: { js: '[name].js' },
          cleanDistPath: true,
          legalComments: 'none',
          sourceMap: true,
          minify: false,
        },
        tools: {
          rspack: (config) => {
            config.target = 'electron-main'
            config.externalsType = 'commonjs'
            config.resolve ??= {}
            config.resolve.alias = { ...(config.resolve.alias || {}), '@': path.resolve(process.cwd(), 'src') }
            return config
          },
        },
      },
      custom,
    ),
  )
}
