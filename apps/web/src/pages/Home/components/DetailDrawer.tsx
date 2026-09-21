import { Tabs } from '@base-ui/react/tabs'
import { Download } from 'react-feather'
import { useEffect, useState } from 'react'
import { PkgListClickAction } from 'common/types/configStore'
import { Button, Drawer } from '@/design-system'
import type { FileStat } from '@/types'
import { formatFileSize, formatPkgName } from '@/utils'
import { GameCover } from './GameCover'
import { SimpleList } from './SimpleList'
type Props = {
  visible: boolean
  data?: FileStat
  displayPkgRawTitle?: boolean
  handleCancel: () => void
  handleInstallByActionType: (file: FileStat, action: PkgListClickAction) => void
}
export function DetailDrawer({ visible, data, displayPkgRawTitle, handleCancel, handleInstallByActionType }: Props) {
  const [tab, setTab] = useState<string | number>('info')
  useEffect(() => {
    setTab('info')
  }, [data?.filename])
  return (
    <Drawer
      visible={visible}
      title={formatPkgName(data, displayPkgRawTitle)}
      onCancel={handleCancel}
      width={780}
      className="game-detail-drawer"
      background={
        data?.icon0 ? (
          <div className="game-detail-backdrop" aria-hidden="true">
            <img
              key={data.icon0}
              src={data.icon0}
              alt=""
              onError={(event) => {
                event.currentTarget.style.visibility = 'hidden'
              }}
            />
          </div>
        ) : undefined
      }
      footer={
        <Button
          type="primary"
          icon={<Download />}
          disabled={!data}
          onClick={() => data && handleInstallByActionType(data, PkgListClickAction.install)}
        >
          发送安装任务
        </Button>
      }
    >
      {data && (
        <>
          <div className="game-detail-hero">
            <div className="game-cover">
              <GameCover file={data} />
            </div>
            <div>
              <span className="muted">PLAYSTATION 4</span>
              <h2>{formatPkgName(data, displayPkgRawTitle)}</h2>
              <p>{formatFileSize(data.size)}</p>
              <p>{data.paramSfo?.TITLE_ID || '尚未读取标题 ID'}</p>
              <p>版本 {data.paramSfo?.APP_VER || data.paramSfo?.VERSION || '—'}</p>
            </div>
          </div>
          <Tabs.Root className="game-detail-tabs" value={tab} onValueChange={setTab}>
            <Tabs.List className="detail-tabs">
              <Tabs.Tab value="info">游戏信息</Tabs.Tab>
              {Boolean(data.patchs?.length) && <Tabs.Tab value="patch">补丁 ({data.patchs!.length})</Tabs.Tab>}
              {Boolean(data.addons?.length) && <Tabs.Tab value="addon">DLC ({data.addons!.length})</Tabs.Tab>}
            </Tabs.List>
            <Tabs.Panel value="info">
              <dl className="game-metadata">
                <div>
                  <dt>文件名</dt>
                  <dd>{data.basename}</dd>
                </div>
                {Object.entries(data.paramSfo || {}).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Tabs.Panel>
            <Tabs.Panel value="patch">
              <SimpleList
                fallbackCover={data.icon0}
                data={data.patchs || []}
                handleInstallByActionType={handleInstallByActionType}
              />
            </Tabs.Panel>
            <Tabs.Panel value="addon">
              <SimpleList
                fallbackCover={data.icon0}
                data={data.addons || []}
                handleInstallByActionType={handleInstallByActionType}
              />
            </Tabs.Panel>
          </Tabs.Root>
        </>
      )}
    </Drawer>
  )
}
