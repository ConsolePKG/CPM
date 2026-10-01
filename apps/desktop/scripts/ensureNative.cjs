const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')

const appDir = resolve(__dirname, '..')
const probe = () =>
  spawnSync(
    require('electron'),
    ['-e', "const Database = require('better-sqlite3'); new Database(':memory:').close()"],
    {
      cwd: appDir,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
    },
  )

async function main() {
  if (probe().status === 0) return
  console.log('Rebuilding better-sqlite3 for Electron…')
  const { rebuild } = await import('@electron/rebuild')
  await rebuild({
    buildPath: appDir,
    electronVersion: require('electron/package.json').version,
    onlyModules: ['better-sqlite3'],
    force: true,
  })
  const result = probe()
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'SQLite native module unavailable')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
