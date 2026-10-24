import Icon from '../ui/Icon.jsx'

export function Logo({ inverse = false }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid size-10 place-items-center rounded-xl"
        style={{ backgroundColor: inverse ? '#ffffff' : '#155C4F', color: inverse ? '#155C4F' : '#ffffff' }}
      >
        <Icon name="chart" className="size-5" />
      </div>
      <span className={`text-xl font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-slate-900'}`}>
        BudgetFlow
      </span>
    </div>
  )
}

export default Logo
