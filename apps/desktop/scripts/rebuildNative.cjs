module.exports = async (context) => {
  const { rebuild } = await import('@electron/rebuild')
  await rebuild({
    buildPath: context.appDir,
    electronVersion: context.electronVersion || require('electron/package.json').version,
    platform: context.platform.nodeName,
    arch: context.arch,
    onlyModules: ['better-sqlite3'],
    force: true,
  })
  return true
}
