import { defineConfig } from '@rslib/core'
import type { RsbuildEntry } from '@rsbuild/core'
import { globSync } from 'glob'
import { getRsSharedConfig, type RsSharedOptions } from '../rs-shared/config'

export type RslibCustomOptions = RsSharedOptions & { bundless?: boolean; bundlessExclude?: string; dts?: boolean }

export const getRslibPresetConfig = (options: RslibCustomOptions = {}) => {
  const { bundless = true, bundlessExclude = '!**/*.{md,bak,back}', dts = false, entry: customEntry } = options
  const matched =
    customEntry || (bundless ? undefined : globSync('src/index.{ts,js,tsx,jsx,mjs,cjs}', { cwd: process.cwd() })[0])
  const entry =
    customEntry ?? (bundless ? { index: ['src/**/*', bundlessExclude] } : { index: matched ?? './src/index.ts' })
  return defineConfig({
    ...getRsSharedConfig('rslib', { ...options, entry: entry as RsbuildEntry }),
    lib: [{ format: 'esm', bundle: !bundless, autoExtension: true, syntax: 'es2015', dts }],
  })
}
