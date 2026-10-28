export function Avatar({ initials, size = 'md', color = 'amber' }) {
  const sizeClasses = {
    sm: 'size-8 text-xs',
    md: 'size-10 text-sm',
    lg: 'size-12 text-base',
    xl: 'size-24 text-2xl',
  }

  const bgColors = {
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    rose: 'bg-rose-100 text-rose-800',
    purple: 'bg-purple-100 text-purple-800',
  }

  const classes = bgColors[color] || bgColors.amber

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-xl font-bold ${sizeClasses[size]} ${classes}`}
    >
      {initials}
    </span>
  )
}

export default Avatar
