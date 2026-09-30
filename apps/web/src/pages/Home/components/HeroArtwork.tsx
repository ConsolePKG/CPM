import { useEffect, useRef, useState } from 'react'

export function HeroArtwork({ src, animate }: { src: string; animate: boolean }) {
  const ref = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    const image = ref.current
    if (!animate || !ready || !image || typeof IntersectionObserver === 'undefined') return
    let inView = false
    const update = () => setRunning(inView && !document.hidden)
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting
        update()
      },
      { root: image.closest('.game-page-scroll') },
    )
    observer.observe(image.parentElement!)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
      setRunning(false)
    }
  }, [animate, ready])
  return (
    <img
      ref={ref}
      className="detail-hero-art"
      src={src}
      alt=""
      data-ready={ready || undefined}
      data-motion={(animate && ready) || undefined}
      data-running={(animate && running) || undefined}
      onLoad={() => setReady(true)}
    />
  )
}
