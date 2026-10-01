import { ContextMenu } from '@base-ui/react/context-menu'
import { PkgListClickAction } from 'common/types/configStore'
import type { ReactElement } from 'react'
import type { FileStat } from '@/types'
import { retryLibraryFile } from '@/library/runtime'
import { Notification } from '@/components/ui'
import { useContainer } from '@/store/container'
export function GameActions({
  file,
  onAction,
  children,
}: {
  file: FileStat
  onAction: (file: FileStat, action: PkgListClickAction) => void
  children: ReactElement
}) {
  const {
    ps4Installer: { isSendingInstall },
  } = useContainer()
  const sending = isSendingInstall(file)
  if (file.type === 'directory') return children
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="cpm-positioner">
          <ContextMenu.Popup className="cpm-popup game-context">
            <ContextMenu.Item className="cpm-option" onClick={() => onAction(file, PkgListClickAction.detail)}>
              查看详情
            </ContextMenu.Item>
            <ContextMenu.Item
              className="cpm-option"
              disabled={sending || (!!file.resourceId && !['ready', 'partial'].includes(file.parseState || ''))}
              onClick={() => onAction(file, PkgListClickAction.install)}
            >
              {sending ? '正在发送…' : '安装游戏'}
            </ContextMenu.Item>
            {file.resourceId && file.parseState === 'failed' && (
              <ContextMenu.Item
                className="cpm-option"
                onClick={() => {
                  void retryLibraryFile(file).catch((error) => Notification.error(error.message))
                }}
              >
                重试解析
              </ContextMenu.Item>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
