import Icon from '../ui/Icon.jsx'

export function PageTitle({ title, sub, action, breadcrumbs }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex-1">
        {breadcrumbs && (
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <Icon name="arrow" className="size-3" />}
                {b}
              </span>
            ))}
          </div>
        )}
        <div className="text-2xl font-bold tracking-tight md:text-3xl">{title}</div>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export default PageTitle
