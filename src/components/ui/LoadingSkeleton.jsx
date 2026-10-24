export function LoadingSkeleton({ lines = 4, className = '' }) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl bg-slate-200 ${i === lines - 1 ? 'h-4 w-3/4' : 'h-4 w-full'}`}
        />
      ))}
    </div>
  )
}

export default LoadingSkeleton
