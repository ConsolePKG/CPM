import { createContainer } from '@/context/container'
import { useFileServer } from '@/hooks/useFileServer'
import { usePS4Installer } from '@/hooks/usePS4Installer'
import { useSettings } from '@/hooks/useSettings'
import { FileServerType, FileStat } from '@/types'

const useHook = () => {
  const { settings, chnageSettings } = useSettings()

  const fileServer = useFileServer({
    forceWebDavDownloadLinkToHttp: settings.forceWebDavDownloadLinkToHttp,
    aggregationMode: settings.aggregationMode,
  })
  const { curHost: curFileServerHost } = fileServer

  const ps4Installer = usePS4Installer(curFileServerHost?.id)

  const handleInstall = async (file: FileStat) => {
    if (curFileServerHost?.type === FileServerType.StaticFileServer) {
      file.downloadUrl = curFileServerHost.url + encodeURI(file.filename.replace(/\\/g, '/'))
    }
    ps4Installer.handleInstall(file)
  }

  return {
    fileServer,
    ps4Installer,
    handleInstall,
    settings,
    chnageSettings,
  }
}

export const { useContainer, Provider } = createContainer(useHook)
