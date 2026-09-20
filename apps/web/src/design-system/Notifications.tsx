import { Toast } from '@base-ui/react/toast'
import { X } from 'react-feather'
import type { ReactNode } from 'react'
const manager = Toast.createToastManager()
type Notice = string | { id?: string; title?: ReactNode; content?: ReactNode; duration?: number; onClose?: () => void }
const notify = (type: string, notice: Notice) => {
  const config = typeof notice === 'string' ? { content: notice } : notice
  return manager.add({
    id: config.id,
    title: config.title,
    description: config.content,
    timeout: config.duration === 0 ? 0 : (config.duration ?? 5) * 1000,
    type,
    onClose: config.onClose,
    priority: type === 'error' ? 'high' : 'low',
  })
}
export const Notification = {
  success: (notice: Notice) => notify('success', notice),
  error: (notice: Notice) => notify('error', notice),
  info: (notice: Notice) => notify('info', notice),
  warning: (notice: Notice) => notify('warning', notice),
  remove: (id?: string) => manager.close(id),
}
export const Message = Notification
function Toasts() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport className="cpm-toasts">
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className="cpm-toast" data-kind={toast.type}>
            <Toast.Content>
              <Toast.Title className="cpm-toast-title" />
              <Toast.Description className="cpm-toast-description" />
              <Toast.Close className="cpm-toast-close" aria-label="关闭通知">
                <X size={16} />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={manager} limit={4}>
      {children}
      <Toasts />
    </Toast.Provider>
  )
}
