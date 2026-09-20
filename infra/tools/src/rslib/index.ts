import { defineConfig, mergeRslibConfig, type RslibConfig } from '@rslib/core'
import { getRslibPresetConfig, type RslibCustomOptions } from './preset-config'

export * from '../rs-shared'
export * from './preset-config'
export * from '@rslib/core'

export const defineConfigWithPreset = (options?: Partial<RslibConfig> & { infraToolsOptions?: RslibCustomOptions }) => {
  const { infraToolsOptions, ...customConfig } = options || {}
  const presetConfig = getRslibPresetConfig(infraToolsOptions)
  return defineConfig({ ...mergeRslibConfig(presetConfig, customConfig), lib: customConfig.lib ?? presetConfig.lib })
}
