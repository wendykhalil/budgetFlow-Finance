import Card from './Card.jsx'

export function ChartCard({ title, subtitle, right, children, className = '' }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <div>
          {title && <div className="font-bold text-slate-900">{title}</div>}
          {subtitle && <div className="text-xs text-slate-400">{subtitle}</div>}
        </div>
        {right && <div>{right}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  )
}

export default ChartCard
