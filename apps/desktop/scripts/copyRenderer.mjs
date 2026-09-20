import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.resolve(currentDir, '..')
const rendererPath = path.resolve(desktopDir, '../web/dist')
const targetPath = path.resolve(desktopDir, 'dist/renderer')
const assetsPath = path.resolve(desktopDir, 'assets')
const targetAssetsPath = path.resolve(desktopDir, 'dist/assets')

fs.rmSync(targetPath, { recursive: true, force: true })
fs.cpSync(rendererPath, targetPath, { recursive: true })
fs.rmSync(targetAssetsPath, { recursive: true, force: true })
fs.cpSync(assetsPath, targetAssetsPath, { recursive: true })
