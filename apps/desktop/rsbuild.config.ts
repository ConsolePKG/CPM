import { defineElectronConfig } from 'infra-tools/rsbuild/electron'

export default defineElectronConfig({
  source: {
    entry: {
      index: './src/index.ts',
      preload: './src/preload.ts',
    },
  },
  output: {
    sourceMap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
  },
})
