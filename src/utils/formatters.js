import { normalizeCurrency } from "@/utils/currencies"
import { formatCalendarDate } from "@/utils/calendarDates"

export function formatCurrency(amount, currency = "EUR") {
  return formatSignedCurrency(amount, currency)
}

export function formatUserCurrency(amount, currency = "EUR") {
  const safeCurrency = normalizeCurrency(currency)
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: safeCurrency,
  }).format(Number(amount) || 0)
}

export function formatPrice(amount, currency = "EUR") {
  return formatSignedCurrency(amount, currency)
}

export function formatSignedCurrency(amount, currency = "EUR") {
  const safeCurrency = normalizeCurrency(currency)
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: safeCurrency,
    signDisplay: "exceptZero",
  }).format(Number(amount) || 0)
}

export function formatDate(dateString) {
  return formatCalendarDate(dateString, "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDateLong(dateString) {
  return formatCalendarDate(dateString, "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function formatDateShort(dateString) {
  return formatCalendarDate(dateString, "en-GB", {
    month: "short",
    day: "numeric",
  })
}

export function calculateProgress(spent, limit) {
  if (limit === 0) return 0
  return Math.min((spent / limit) * 100, 100)
}

export function getTransactionTypeColor(type) {
  return type === "income" ? "text-emerald-600" : "text-slate-800"
}

export function getBudgetStatus(spent, limit) {
  const progress = (spent / limit) * 100
  if (progress >= 100) return "exceeded"
  if (progress >= 85) return "warning"
  return "healthy"
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
        t.category.toLowerCase().includes(search),
    )
  }

  if (filters.type && filters.type !== "all") {
    result = result.filter((t) => t.type === filters.type)
  }

  if (filters.status && filters.status !== "all") {
    result = result.filter((transaction) =>
      filters.status === "completed"
        ? transaction.status == null || transaction.status === "completed"
        : transaction.status === filters.status,
    )
  }

  if (filters.category && filters.category !== "all") {
    if (typeof filters.category === "object") {
      if (filters.category.kind === "linked") {
        result = result.filter((transaction) => {
          const categoryId =
            typeof transaction.categoryId === "object"
              ? transaction.categoryId?.id || transaction.categoryId?._id
              : transaction.categoryId
          return (
            categoryId != null && String(categoryId) === filters.category.id
          )
        })
      } else if (filters.category.kind === "legacy") {
        result = result.filter(
          (transaction) =>
            !transaction.categoryId &&
            transaction.category === filters.category.name &&
            transaction.type === filters.category.type,
        )
      }
    } else {
      result = result.filter((t) => t.category === filters.category)
    }
  }

  if (filters.date && filters.date !== "all") {
    const now = filters.now || new Date()
    const currentYear = now.getFullYear()
    const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const previousMonthKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`

    if (filters.date === "this-month") {
      result = result.filter(
        (transaction) =>
          typeof transaction.date === "string" &&
          transaction.date.startsWith(currentMonthKey),
      )
    } else if (filters.date === "last-month") {
      result = result.filter(
        (transaction) =>
          typeof transaction.date === "string" &&
          transaction.date.startsWith(previousMonthKey),
      )
    } else if (filters.date === "this-year") {
      result = result.filter(
        (transaction) =>
          typeof transaction.date === "string" &&
          transaction.date.startsWith(`${currentYear}-`),
      )
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
