import Icon from './Icon.jsx'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className = '',
  type = 'button',
  disabled = false,
  icon,
}) {
  const styles = {
    primary: 'bg-[#155C4F] text-white hover:bg-[#104B41]',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    outline: 'border border-slate-200 text-slate-600 hover:bg-slate-50',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }
  const baseClasses = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${sizes[size]} ${className}`

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={baseClasses}>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      {children}
    </button>
  )
}

export default Button
