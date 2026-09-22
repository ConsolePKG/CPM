import { forwardRef, type HTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { isPlayStationBrowser } from '@/utils/browser'

// Route pages on PS4 skip Motion entirely, including its frame scheduling and
// temporary opacity/transform layers. Base UI's DOM props/ref are still forwarded.
const StaticSurface = forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>((props, ref) => {
  const domProps = { ...props }
  delete domProps.initial
  delete domProps.animate
  delete domProps.variants
  delete domProps.transition
  delete domProps.onAnimationComplete
  return <div {...(domProps as unknown as HTMLAttributes<HTMLDivElement>)} ref={ref} />
})

export const RouteSurface = isPlayStationBrowser ? StaticSurface : motion.div
