import { defineConfig, type RstestConfig } from '@rstest/core'

export const defineConfigWithPreset = (options: RstestConfig = {}) =>
  defineConfig({ testEnvironment: 'happy-dom', globals: true, ...options })

export * from '@rstest/core'
