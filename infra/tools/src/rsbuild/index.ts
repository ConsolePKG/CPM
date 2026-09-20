import { defineConfig, mergeRsbuildConfig, type RsbuildConfig } from '@rsbuild/core'
import { getRsbuildPresetConfig, type RsbuildCustomOptions } from './preset-config'

export * from '../rs-shared'
export * from './preset-config'
export * from '@rsbuild/core'

export const defineConfigWithPreset = (
  options?: Partial<RsbuildConfig> & { infraToolsOptions?: RsbuildCustomOptions },
) => {
  const { infraToolsOptions, ...customConfig } = options || {}
  return defineConfig(mergeRsbuildConfig(getRsbuildPresetConfig(infraToolsOptions), customConfig))
}
