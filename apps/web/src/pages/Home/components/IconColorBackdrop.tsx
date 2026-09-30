import { useEffect, useState } from 'react'

/** Sample ICON0 once; soft gradients avoid a large live blur layer on PS4. */
export function IconColorBackdrop({ src }: { src?: string }) {
  const [colors, setColors] = useState<{ src: string; background: string }>()
  useEffect(() => {
    if (!src) return
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 3
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) return
        context.drawImage(image, 0, 0, 3, 1)
        const pixels = context.getImageData(0, 0, 3, 1).data
        const positions = ['0% 20%', '50% 0%', '100% 30%']
        const background = positions
          .map((position, i) => {
            const offset = i * 4
            return `radial-gradient(ellipse at ${position}, rgba(${pixels[offset]}, ${pixels[offset + 1]}, ${pixels[offset + 2]}, ${(pixels[offset + 3] / 255) * 0.35}), transparent 75%)`
          })
          .join(', ')
        setColors({ src, background })
      } catch {
        // Unreadable or cross-origin icons retain the normal page surface.
      }
    }
    image.src = src
    return () => {
      cancelled = true
      image.onload = null
    }
  }, [src])
  return (
    <div
      className="detail-icon-colors"
      aria-hidden="true"
      style={{ background: colors?.src === src ? colors.background : undefined }}
    />
  )
}
