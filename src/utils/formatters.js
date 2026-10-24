export function formatCurrency(amount) {
  const sign = amount >= 0 ? '+' : ''
  const abs = Math.abs(amount)
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  return `${sign}€${formatted}`
}

export function formatPrice(amount) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    signDisplay: 'exceptZero',
  }).format(amount).replace(/\s/g, '\u00A0')
}

export function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateLong(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatDateShort(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })
}

export function calculateProgress(spent, limit) {
  if (limit === 0) return 0
  return Math.min((spent / limit) * 100, 100)
}

export function getTransactionTypeColor(type) {
  return type === 'income' ? 'text-emerald-600' : 'text-slate-800'
}

export function getBudgetStatus(spent, limit) {
  const progress = (spent / limit) * 100
  if (progress >= 100) return 'exceeded'
  if (progress >= 85) return 'warning'
  return 'healthy'
}

export function debounce(fn, delay) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

export function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function filterTransactions(transactions, filters) {
  let result = [...transactions]

  if (filters.search) {
    const search = filters.search.toLowerCase()
    result = result.filter(
      (t) =>
        t.description.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search)
    )
  }

  if (filters.type && filters.type !== 'all') {
    result = result.filter((t) => t.type === filters.type)
  }

  if (filters.category && filters.category !== 'all') {
    result = result.filter((t) => t.category === filters.category)
  }

  if (filters.date && filters.date !== 'all') {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    if (filters.date === 'this-month') {
      result = result.filter((t) => {
        const d = new Date(t.date)
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
      })
    } else if (filters.date === 'last-month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear
      result = result.filter((t) => {
        const d = new Date(t.date)
        return d.getMonth() + 1 === lastMonth && d.getFullYear() === lastYear
      })
    } else if (filters.date === 'this-year') {
      result = result.filter((t) => new Date(t.date).getFullYear() === currentYear)
    }
  }

  return result
}

export function paginate(items, currentPage, itemsPerPage) {
  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = items.slice(startIndex, endIndex)

  return {
    items: paginatedItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex: startIndex + 1,
    endIndex: Math.min(endIndex, totalItems),
  }
}
