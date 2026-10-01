import { useFileServerForm } from '@/hooks/useHostForms'
import { Plus } from 'react-feather'
import { Button, Empty } from '@/design-system'
export function FileServerHostEmpty() {
  const { open } = useFileServerForm()
  return (
    <Empty description="添加本地文件夹、WebDAV 或资源库服务，开始浏览游戏。">
      <h2>你的游戏库，从这里开始</h2>
      <Button type="primary" icon={<Plus />} onClick={() => open()}>
        添加资源库
      </Button>
    </Empty>
  )
}
