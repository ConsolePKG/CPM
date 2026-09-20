import path from 'node:path'
import { defineConfigWithPreset } from 'infra-tools/rsbuild'
import { version } from './package.json'

export default defineConfigWithPreset({
  source: {
    define: {
      _app_version: JSON.stringify(version),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  output: {
    assetPrefix: './',
    sourceMap: true,
  },
  html: {
    template: './index.html',
  },
})
