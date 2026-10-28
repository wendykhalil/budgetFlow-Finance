export function Card({ children, className = '', padding = 'md', hover = false }) {
  const paddings = {
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-7',
    none: 'p-0',
  }

  return (
    <section
      className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white shadow-sm ${paddings[padding]} ${hover ? 'transition-shadow hover:shadow-md' : ''} ${className}`}
    >
      {children}
    </section>
  )
}

export default Card
