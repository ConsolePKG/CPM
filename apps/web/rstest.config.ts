import { defineConfig } from '@rstest/core'
import path from 'node:path'
export default defineConfig({
  testEnvironment: 'happy-dom',
  include: ['tests/**/*.test.ts'],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
})
