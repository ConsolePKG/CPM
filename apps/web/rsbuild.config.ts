import path from 'node:path'
import { defineConfigWithPreset } from 'infra-tools/rsbuild'
import { version } from './package.json'

export default defineConfigWithPreset({
  server: {
    host: '0.0.0.0',
    cors: {
      origin: '*',
      methods: ['GET', 'HEAD', 'OPTIONS'],
      allowedHeaders: ['Range', 'Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges'],
    },
  },
  source: {
    // Dependencies also ship modern syntax (webdav private fields, Base UI optional
    // chaining). Transpile them for old WebKit, excluding the polyfill runtime.
    include: [
      {
        and: [
          /[\\/]node_modules[\\/]/,
          { not: /[\\/]node_modules[\\/](?:core-js|@swc[\\/]helpers)[\\/]/ },
        ],
      },
    ],
    define: {
      _app_version: JSON.stringify(version),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@njzy/ps4-pkg-info/web': path.resolve(__dirname, '../../packages/ps4-pkg-info/src/web/index.ts'),
    },
  },
  output: {
    // PS4 reports WebKit 605; keep generated syntax compatible with Safari 11.1.
    overrideBrowserslist: ['chrome >= 107', 'edge >= 107', 'firefox >= 104', 'safari >= 11.1'],
    polyfill: 'entry',
    assetPrefix: './',
    sourceMap: true,
  },
  html: {
    template: './index.html',
    favicon: './src/assets/icon.svg',
  },
})
