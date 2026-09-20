import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'react-feather'
import { Button, Empty } from '@/design-system'
export function FileServerHostEmpty() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Empty description="连接 WebDAV 或文件服务器，开始浏览你的游戏。">
      <h2>你的游戏库，从这里开始</h2>
      <Button
        type="primary"
        icon={<Plus />}
        onClick={() => navigate('/settings/servers?add=true', { state: { backgroundLocation: location } })}
      >
        添加游戏来源
      </Button>
    </Empty>
  )
}
