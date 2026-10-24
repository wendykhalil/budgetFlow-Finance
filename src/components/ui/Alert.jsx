export function Alert({ type = 'info', title, message, className = '' }) {
  const configs = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      icon: 'bg-rose-100',
      iconColor: 'text-rose-600',
    },
  }

  const config = configs[type]

  return (
    <div className={`rounded-xl border p-4 ${config.bg} ${config.border} ${config.text} ${className}`}>
      <div className="flex gap-3">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full ${config.icon} ${config.iconColor}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {type === 'info' && <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />}
            {type === 'success' && <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-7-7" />}}
            {type === 'warning' && <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3l-8.5-14.14a2 2 0 0 0-3.44 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />}
            {type === 'error' && <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />}
          </svg>
        </span>
        <div>
          {title && <div className="font-semibold">{title}</div>}
          {message && <div className="mt-1 text-sm">{message}</div>}
        </div>
      </div>
    </div>
  )
}

export default Alert
