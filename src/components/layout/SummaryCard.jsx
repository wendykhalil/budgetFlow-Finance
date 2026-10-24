import Badge from '../ui/Badge.jsx'
import Card from '../ui/Card.jsx'
import Icon from '../ui/Icon.jsx'

export function SummaryCard({ label, value, change, icon, tone, subtitle }) {
  return (
    <Card className="flex items-start justify-between">
      <div className={`grid size-11 place-items-center rounded-xl ${tone}`}>
        <Icon name={icon} className="size-5" />
      </div>
      <div className="text-right">
        <Badge tone={change.startsWith('+') ? 'green' : 'red'}>{change}</Badge>
        <div className="mt-5 text-sm font-medium text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {subtitle && <div className="mt-2 text-xs text-slate-400">{subtitle}</div>}
      </div>
    </Card>
  )
}

export default SummaryCard
