import { useId } from 'react'

export function Input({
  label,
  type = 'text',
  placeholder = '',
  defaultValue = '',
  value,
  onChange,
  error = '',
  className = '',
  icon,
  prefix,
  id,
  disabled,
  ...props
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const inputClasses = `peer w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 ${icon ? 'pl-10' : ''} ${prefix ? 'pl-10' : ''} ${error ? 'border-rose-300' : ''} ${className}`

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange}
          className={inputClasses}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          {...props}
        />
      </div>
      {error && <span id={errorId} role="alert" className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

export default Input
