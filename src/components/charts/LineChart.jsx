export function LineChart({ data, height = 200, color = '#267968', className = '' }) {
  const width = 500
  const padding = 30
  const innerWidth = width - padding - 30
  const innerHeight = height - padding - 30
  const maxValue = Math.max(...data.map((d) => d.value))
  const minValue = Math.min(0, ...data.map((d) => d.value))
  const range = maxValue - minValue || 1

  const points = data
    .map((d, i) => {
      const x = padding + (i * innerWidth) / (data.length - 1)
      const y = padding + innerHeight - ((d.value - minValue) / range) * innerHeight
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `${points} L ${padding + innerWidth},${padding + innerHeight} ${padding},${padding + innerHeight} Z`

  return (
    <div className={`relative ${className}`} style={{ height: `${height}px` }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.25" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPoints} fill="url(#lineGradient)" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <line x1={padding} x2={padding + innerWidth} y1={padding + innerHeight} y2={padding + innerHeight} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((d, i) => {
          const x = padding + (i * innerWidth) / (data.length - 1)
          return (
            <text key={i} x={x} y={padding + innerHeight + 18} textAnchor="middle" fontSize={10} fill="#94a3b8">
              {d.month}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export default LineChart
