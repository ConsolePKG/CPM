import { useId } from 'react'
import { formatFileSize } from '@/utils'

export function SpeedChart({ samples }: { samples: number[] }) {
  const gradientId = useId().replace(/:/g, '')
  const values = samples.slice(-20).map((value) => Math.max(0, Number.isFinite(value) ? value : 0))
  if (values.length < 2) return null
  const peak = Math.max(...values, 1)
  const ceiling = Math.max(16 * 1024 ** 2, 2 ** Math.ceil(Math.log2(peak)))
  const points = values.map((speed, index) => ({
    x: 2 + ((20 - values.length + index) / 19) * 236,
    y: 70 - (speed / ceiling) * 62,
  }))
  const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  return (
    <div className="task-chart">
      <svg
        viewBox="0 0 240 76"
        preserveAspectRatio="none"
        role="img"
        aria-label={`最近总下载速度变化，峰值 ${formatFileSize(peak)}/s`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        <path d={`${line} L${last.x},70 L${first.x},70 Z`} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
