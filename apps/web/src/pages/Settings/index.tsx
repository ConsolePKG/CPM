import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'react-feather'
import { useLocation, useNavigate } from 'react-router-dom'
import { PkgListClickAction } from 'common/types/configStore'
import { Button, IconButton, SegmentedControl, SettingRow, Switch, useTheme } from '@/design-system'
import { useContainer } from '@/store/container'
import type { SettingsLocationState } from '@/routes'
import { FileServerHost } from '../Hosts/components/FileServerHost'
import { PS4Host } from '../Hosts/components/PS4Host'
import { Info } from './components/Info'
import './settings.less'
import { HostFormDialogs } from '@/components/HostFormDialogs'
const sections = [
  {
    title: '应用设置',
    items: [
      { id: 'general', title: '常规' },
      { id: 'library', title: '游戏库' },
      { id: 'transfer', title: '下载与安装' },
    ],
  },
  {
    title: '连接管理',
    items: [
      { id: 'servers', title: '文件服务器' },
      { id: 'hosts', title: 'PS4 主机' },
    ],
  },
  {
    title: '应用信息',
    items: [
      { id: 'advanced', title: '更新与调试', desktop: true },
      { id: 'about', title: '关于 CPM' },
    ],
  },
]
export const Settings = () => {
  const { settings, chnageSettings } = useContainer()
  const { mode, setMode } = useTheme()
  const [open, setOpen] = useState(true)
  const reduceMotion = useReducedMotion()
  const transition = {
    duration: reduceMotion ? 0 : open ? 0.2 : 0.18,
    ease: [0.25, 0.1, 0.25, 1] as const,
  }
  const contentMotion = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 6 },
    visible: { opacity: 1, y: 0 },
    exiting: { opacity: 0, y: reduceMotion ? 0 : 6 },
  }
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as SettingsLocationState | null
  const legacy = location.pathname === '/hosts'
  const section = legacy
    ? location.search.includes('openPs4Host')
      ? 'hosts'
      : 'servers'
    : location.pathname.split('/')[2] || 'general'
  const title = sections.flatMap((group) => group.items).find((item) => item.id === section)?.title || '常规'
  const close = () => setOpen(false)
  const finishClose = () => {
    if (state?.backgroundLocation) navigate(-1)
    else navigate('/', { replace: true })
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="settings-backdrop">
          <motion.div
            className="settings-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={transition}
          />
        </Dialog.Backdrop>
        <Dialog.Popup
          className="settings-screen"
          data-closing={!open || undefined}
          finalFocus={() => document.getElementById('settings-trigger')}
          render={
            <motion.div
              initial="hidden"
              animate={open ? 'visible' : 'exiting'}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1 },
                exiting: { opacity: 0 },
              }}
              transition={transition}
              onAnimationComplete={(phase) => {
                if (phase === 'exiting' && !open) finishClose()
              }}
            />
          }
        >
          <aside className="settings-sidebar">
            <motion.div className="settings-nav-inner" variants={contentMotion} transition={transition}>
              <div className="settings-brand">
                CPM<small>设置</small>
              </div>
              {sections.map((group) => (
                <div className="settings-nav-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.items
                    .filter((item) => !('desktop' in item && item.desktop) || Boolean(window.electron))
                    .map((item) => (
                      <Button
                        key={item.id}
                        variant="text"
                        className={section === item.id ? 'is-active' : ''}
                        onClick={() => navigate(`/settings/${item.id}`, { replace: true, state })}
                      >
                        {item.title}
                      </Button>
                    ))}
                </div>
              ))}
              <p className="settings-version">CPM · {_app_version}</p>
            </motion.div>
          </aside>
          <motion.div
            key={section}
            className="settings-body"
            variants={contentMotion}
            initial="hidden"
            animate={open ? 'visible' : 'exiting'}
            transition={transition}
          >
            <Dialog.Title className="settings-title">{title}</Dialog.Title>
            <Dialog.Description className="settings-description">
              {section === 'library'
                ? '调整游戏内容的组织方式与打开行为。'
                : section === 'general'
                  ? '让 CPM 适合你的使用习惯。'
                  : '管理应用偏好与连接。'}
            </Dialog.Description>
            {section === 'general' && (
              <>
                <SettingRow title="外观" description="选择日间、夜间，或跟随系统自动切换。">
                  <SegmentedControl
                    label="外观"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'light', label: '日间' },
                      { value: 'dark', label: '夜间' },
                      { value: 'system', label: '跟随系统' },
                    ]}
                  />
                </SettingRow>
                <SettingRow title="显示应用 Logo" description="在顶部 CPM 品牌区域显示应用 Logo。">
                  <Switch
                    label="显示应用 Logo"
                    checked={settings.displayLogo}
                    onChange={(value) => chnageSettings({ displayLogo: value })}
                  />
                </SettingRow>
              </>
            )}
            {section === 'library' && (
              <>
                <SettingRow
                  title="聚合模式"
                  description="将补丁与附加内容关联到本体，不单独出现在列表中。可在游戏详情查看，建议搭配文件服务器的递归查询。"
                >
                  <Switch
                    label="聚合模式"
                    checked={settings.aggregationMode}
                    onChange={(value) => chnageSettings({ aggregationMode: value })}
                  />
                </SettingRow>
                <SettingRow title="显示 PKG 原始标题" description="关闭时使用文件名作为游戏标题。">
                  <Switch
                    label="显示 PKG 原始标题"
                    checked={settings.displayPkgRawTitle}
                    onChange={(value) => chnageSettings({ displayPkgRawTitle: value })}
                  />
                </SettingRow>
                <SettingRow title="点击游戏时" description="选择点击游戏封面的默认行为。">
                  <SegmentedControl
                    label="点击游戏时"
                    value={settings.pkgListClickAction}
                    onChange={(value) => chnageSettings({ pkgListClickAction: value })}
                    options={[
                      { value: PkgListClickAction.detail, label: '查看详情' },
                      { value: PkgListClickAction.install, label: '直接安装' },
                    ]}
                  />
                </SettingRow>
              </>
            )}
            {section === 'transfer' && (
              <SettingRow
                title="强制 WebDAV 下载链接使用 HTTP"
                description="向 PS4 发送安装任务前，将 WebDAV 下载链接转换为 HTTP。"
              >
                <Switch
                  label="强制使用 HTTP"
                  checked={settings.forceWebDavDownloadLinkToHttp}
                  onChange={(value) => chnageSettings({ forceWebDavDownloadLinkToHttp: value })}
                />
              </SettingRow>
            )}
            {section === 'servers' && <FileServerHost />}
            {section === 'hosts' && <PS4Host />}
            {section === 'advanced' &&
              (window.electron ? (
                <>
                  <SettingRow title="接收测试版更新" description="启用后可获取 Beta 版本更新。">
                    <Switch
                      label="接收测试版更新"
                      checked={Boolean(settings.useBetaVersion)}
                      onChange={(value) => chnageSettings({ useBetaVersion: value })}
                    />
                  </SettingRow>
                  <SettingRow title="开发者工具" description="查看 Console、Network 等信息，帮助定位问题。">
                    <Button onClick={() => window.electron?.openDevTools()}>打开</Button>
                  </SettingRow>
                  <SettingRow title="应用日志" description="打开日志，查看运行记录与错误信息。">
                    <Button onClick={() => window.electron?.openAppLog()}>打开</Button>
                  </SettingRow>
                </>
              ) : (
                <p className="muted">这些功能仅在桌面端提供。</p>
              ))}
            {section === 'about' && <Info />}
          </motion.div>
          <div className="settings-close">
            <IconButton label="关闭设置" variant="text" onClick={close}>
              <X />
            </IconButton>
            <small>ESC</small>
          </div>
          <HostFormDialogs />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
