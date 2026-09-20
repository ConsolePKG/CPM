import { defineConfigWithPreset } from 'infra-tools/rslib'

export default defineConfigWithPreset({
  infraToolsOptions: {
    bundless: false,
    dts: true,
    entry: { index: './src/web/index.ts' },
  },
  output: {
    distPath: { root: 'web' },
  },
  lib: [
    { format: 'esm', bundle: true, autoExtension: true, syntax: 'es2015', dts: true },
    { format: 'cjs', bundle: true, autoExtension: true, syntax: 'es2015', dts: true },
  ],
})
