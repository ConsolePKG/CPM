import { defineConfigWithPreset } from './src/rslib'

export default defineConfigWithPreset({
  // The package exposes several entry points. Keep the build bundless so each
  // source module remains addressable through the export map and Rslib can
  // generate declarations without requiring a synthetic src/index entry.
  infraToolsOptions: { dts: true, bundless: true },
})
