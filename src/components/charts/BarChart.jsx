import { useEffect, useRef } from 'react'

export function BarChart({ data, xAxisKey, bars, height = 200, className = '' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Chart) {
      const ctx = containerRef.current
      if (ctx) {
        ctx.innerHTML = ''
        new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.map((d) => d[xAxisKey]),
            datasets: bars.map((bar, i) => ({
              label: bar.label,
              data: data.map((d) => d[bar.dataKey]),
              backgroundColor: bar.color,
              borderRadius: 4,
              barThickness: 12,
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, border: { display: false } },
              y: { grid: { display: false }, border: { display: false } },
            },
          },
        })
      }
    }
  }, [data, xAxisKey, bars])

  const maxValue = Math.max(...data.flatMap((d) => bars.map((b) => d[b.dataKey])))
  const chartWidth = 500
  const chartHeight = height
  const paddingLeft = 30
  const paddingString = 10
  const availableWidth = chartWidth - paddingLeft - 50
  const barWidth = availableWidth / data.length / bars.length

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ height: `${height}px` }}>
      <svg
        className={`h-full w-full overflow-visible ${className}`}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <g transform={`translate(${paddingLeft}, 0)`}>
          {data.map((d, i) => {
            let offsetX = 0
            return (
              <g key={d[xAxisKey]} transform={`translate(${i * (availableWidth / data.length)}, 0)`}>
                {bars.map((bar, j) => {
                  const value = d[bar.dataKey]
                  const barH = (value / maxValue) * (chartHeight - paddingString - 20)
                  const x = offsetX
                  const y = chartHeight - paddingString - barH
                  const result = (
                    <g key={bar.dataKey}>
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barH}
                        fill={bar.color}
                        rx={4}
                        ry={4}
                      />
                      {d.label && (
                        <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#94a3b8">
                          {d.label}
                        </text>
                      )}
                    </g>
                  )
                  offsetX += barWidth
                  return result
                })}
              </g>
            )
          })}
          <line x1={-paddingLeft} x2={chartWidth - paddingLeft} y1={chartHeight - paddingString} y2={chartHeight - paddingString} stroke="#e2e8f0" strokeWidth={1} />
          {data.map((d, i) => (
            <text
              key={d[xAxisKey]}
              x={i * (availableWidth / data.length) + barWidth * bars.length / 2 - paddingLeft / 2}
              y={chartHeight - paddingString + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {d[xAxisKey]}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
}

export default BarChart
