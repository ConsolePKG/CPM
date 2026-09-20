export function SpeedChart({ samples }: { samples: number[] }) {
  if (samples.length < 2) return <div className="task-chart-empty">正在采样下载速度…</div>
  const max = Math.max(...samples, 1)
  const values = [...Array(Math.max(0, 20 - samples.length)).fill(0), ...samples]
  return (
    <div className="task-chart">
      <svg viewBox="0 0 240 76" role="img" aria-label="最近下载速度变化">
        {values.map((speed, index) => (
          <rect
            key={index}
            x={index * 12}
            y={70 - (speed / max) * 62}
            width={7}
            height={Math.max(1, (speed / max) * 62)}
            rx={1}
            fill="currentColor"
            opacity={0.7}
          />
        ))}
      </svg>
      <div>
        <span>↓ 下载速度</span>
        <small>最近 {samples.length} 次采样</small>
      </div>
    </div>
  )
}
