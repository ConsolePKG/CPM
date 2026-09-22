import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronDown } from 'react-feather'
import type { ReactNode } from 'react'
import cs from 'classnames'

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} className={cs('cpm-disclosure', className)}>
      <Collapsible.Trigger className="cpm-disclosure-trigger">
        <ChevronDown size={16} aria-hidden="true" />
        <span>{title}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel>{children}</Collapsible.Panel>
    </Collapsible.Root>
  )
}
