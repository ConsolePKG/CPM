import { Link as BaseLink } from '@/components/ui'
import cs from 'classnames'
import type React from 'react'

import styles from './Link.module.less'

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  canceldUnderline?: boolean
  hoverable?: boolean
}

export const Link = ({ canceldUnderline, ...props }: LinkProps) => {
  return (
    <BaseLink {...props} className={cs(styles.link, canceldUnderline && styles.cancelUnderline, props.className)}>
      {props.children}
    </BaseLink>
  )
}
