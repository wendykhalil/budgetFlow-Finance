export function Progress({ value = 0, max = 100, size = 'md', color = 'emerald', className = '' }) {
  const percent = Math.min((value / max) * 100, 100)
  const colors = {
    emerald: 'bg-[#277666]',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    blue: 'bg-blue-500',
  }
  const sizes = {
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-4',
  }

  return (
    <div className={`overflow-hidden rounded-full bg-slate-100 ${sizes[size]} ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${colors[color] || colors.emerald}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export default Progress
