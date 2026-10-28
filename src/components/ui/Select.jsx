import { useId } from 'react'

export function Select({ label, options, defaultValue, value, onChange, className = '', error = '', id }) {
  const generatedId = useId()
  const selectId = id || generatedId
  const errorId = error ? `${selectId}-error` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={selectId} className="text-sm font-semibold text-slate-700">{label}</label>}
      <select
        id={selectId}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-50 ${error ? 'border-rose-300' : ''} ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span id={errorId} className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

export default Select
