export function DonutChart({ data, innerText, innerSubtext, height = 200, className = '' }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = 45
  const centerX = 60
  const centerY = 50
  const gap = 2

  let startAngle = 0
  const arcs = data.map((d) => {
    const fraction = d.value / total
    const angle = fraction * 360
    const startRad = (startAngle * Math.PI) / 180
    const endRad = ((startAngle + angle) * Math.PI) / 180
    const x1 = centerX + radius * Math.cos(startRad)
    const y1 = centerY + radius * Math.sin(startRad)
    const x2 = centerX + radius * Math.cos(endRad)
    const y2 = centerY + radius * Math.sin(endRad)
    const largeArc = angle > 180 ? 1 : 0
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${centerX} ${centerY} Z`
    startAngle += angle + gap
    return { path, color: d.color, name: d.name }
  })

  const viewBox = '0 0 120 100'

  return (
    <div className={`relative ${className}`} style={{ height: `${height}px` }}>
      <svg viewBox={viewBox} className="h-full w-full overflow-visible">
        {arcs.map((arc) => (
          <path key={arc.name} d={arc.path} fill={arc.color} stroke="white" strokeWidth="1.5" />
        ))}
        {innerText && (
          <text x={centerX} y={centerY} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#0f172a">
            {innerText}
          </text>
        )}
        {innerSubtext && (
          <text x={centerX} y={centerY + 14} textAnchor="middle" fontSize={7} fill="#94a3b8">
            {innerSubtext}
          </text>
        )}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-6 text-xs">
        {data.map((d) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export default DonutChart
