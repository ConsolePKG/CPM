import { exec } from 'child_process'
import path from 'path'

import { version } from '../package.json'

const distPath = path.resolve(__dirname, '../dist')

const command = `pnpm sentry-cli releases files "${version}" upload-sourcemaps ${distPath} --org njzy --project ps4rps-web`
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`)
    return
  }
  console.log(`stdout: ${stdout}`)
  console.error(`stderr: ${stderr}`)
})
