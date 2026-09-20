import { Spin } from '@/components/ui'
import cs from 'classnames'
import { CSSProperties, useState } from 'react'
import { LazyLoadImage, LazyLoadImageProps } from 'react-lazy-load-image-component'

import FolderIcon from '@/assets/folder.png'
import Ps4Icon from '@/assets/ps4-icon.png'
import { FileStat } from '@/types'

import styles from './CustomLazyLoadImage.module.less'

type CustomLazyLoadImageProps = {
  data: FileStat
  lazyLoadImageProps?: LazyLoadImageProps
  wrapperStyle?: CSSProperties
  className?: string
}

export const CustomLazyLoadImage = ({
  data,
  lazyLoadImageProps,
  wrapperStyle,
  className,
}: CustomLazyLoadImageProps) => {
  const [loading, setLoading] = useState(true)
  return (
    <div className={cs(styles['img-wrapper'], className)} style={wrapperStyle}>
      <LazyLoadImage
        src={data.type === 'directory' ? FolderIcon : data.icon0 || Ps4Icon}
        afterLoad={() => {
          setLoading(false)
        }}
        {...lazyLoadImageProps}
      />
      {loading && (
        <div className={styles['loading-wrapper']}>
          <Spin />
        </div>
      )}
    </div>
  )
}
