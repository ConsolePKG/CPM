import { ContextMenu } from '@base-ui/react/context-menu'
import { PkgListClickAction } from 'common/types/configStore'
import type { ReactElement } from 'react'
import type { FileStat } from '@/types'
export function GameActions({
  file,
  onAction,
  children,
}: {
  file: FileStat
  onAction: (file: FileStat, action: PkgListClickAction) => void
  children: ReactElement
}) {
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
            <ContextMenu.Item className="cpm-option" onClick={() => onAction(file, PkgListClickAction.install)}>
              安装游戏
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
