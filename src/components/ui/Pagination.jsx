import Icon from './Icon.jsx'

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) {
  const pages = []
  const maxVisible = 3
  const start = Math.max(1, currentPage - 1)
  const end = Math.min(totalPages, start + maxVisible - 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex items-center justify-between text-sm text-slate-500">
      <span>
        Showing {startItem}–{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50`}
        >
          Previous
        </button>
        <div className="flex gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange?.(page)}
              aria-label={`Go to page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              className={`grid size-8 place-items-center rounded-xl text-sm font-semibold ${
                page === currentPage
                  ? 'bg-[#155C4F] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
        <button
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50`}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default Pagination
