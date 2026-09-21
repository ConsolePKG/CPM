import { Dialog } from '@base-ui/react/dialog'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { X } from 'react-feather'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Button, IconButton } from './Button'
export function Drawer({
  visible,
  title,
  children,
  footer,
  onCancel,
  onOk,
  width = 560,
  className = '',
  background,
}: {
  visible: boolean
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  onCancel: () => void
  onOk?: () => void
  width?: number | string
  className?: string
  background?: ReactNode
}) {
  const [present, setPresent] = useState(visible)
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (visible) setPresent(true)
  }, [visible])
  const transition = {
    duration: reduceMotion ? 0 : visible ? 0.2 : 0.18,
    ease: [0.25, 0.1, 0.25, 1] as const,
  }
  const previousOpen = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  if (visible && !previousOpen.current) returnFocus.current = document.activeElement as HTMLElement
  previousOpen.current = visible
  return (
    <Dialog.Root
      open={visible || present}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className="cpm-backdrop"
          render={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: visible ? 1 : 0 }} transition={transition} />
          }
        />
        <Dialog.Popup
          className={`cpm-drawer ${className}`}
          style={{ width }}
          finalFocus={() => returnFocus.current}
          render={
            <motion.div
              initial="hidden"
              animate={visible ? 'shown' : 'hidden'}
              variants={{ hidden: { opacity: 0, x: reduceMotion ? 0 : 24 }, shown: { opacity: 1, x: 0 } }}
              transition={transition}
              onAnimationComplete={(phase) => {
                if (phase === 'hidden' && !visible) setPresent(false)
              }}
            />
          }
        >
          {background}
          <header>
            <Dialog.Title>{title}</Dialog.Title>
            <IconButton label="关闭" variant="text" onClick={onCancel}>
              <X />
            </IconButton>
          </header>
          <div className="cpm-drawer-body">{children}</div>
          {(footer || onOk) && (
            <footer>
              {footer || (
                <>
                  <Button onClick={onCancel}>取消</Button>
                  <Button type="primary" onClick={onOk}>
                    确认
                  </Button>
                </>
              )}
            </footer>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function ConfirmDialog({
  visible,
  title,
  description,
  onCancel,
  onConfirm,
  confirmText = '删除',
}: {
  visible: boolean
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
  confirmText?: string
}) {
  return (
    <AlertDialog.Root
      open={visible}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="cpm-backdrop" />
        <AlertDialog.Popup className="cpm-confirm">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          <footer>
            <Button onClick={onCancel}>取消</Button>
            <Button variant="danger" onClick={onConfirm}>
              {confirmText}
            </Button>
          </footer>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
export function Popover({
  trigger,
  children,
  title,
  hover = false,
  align = 'start',
  open,
  onOpenChange,
}: {
  trigger: ReactElement
  children: ReactNode
  title: string
  hover?: boolean
  align?: 'start' | 'end'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      <BasePopover.Trigger render={trigger} openOnHover={hover} delay={180} closeDelay={200} />
      <BasePopover.Portal>
        <BasePopover.Positioner align={align} sideOffset={10} className="cpm-positioner">
          <BasePopover.Popup className="cpm-popup">
            <BasePopover.Title className="cpm-popup-title">{title}</BasePopover.Title>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  )
}
