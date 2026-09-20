import { defineConfig } from '@rsbuild/core'
import { getRsSharedConfig, type RsSharedOptions } from '../rs-shared/config'

export type RsbuildCustomOptions = RsSharedOptions

export const getRsbuildPresetConfig = (options?: RsbuildCustomOptions) =>
  defineConfig(getRsSharedConfig('rsbuild', options))
