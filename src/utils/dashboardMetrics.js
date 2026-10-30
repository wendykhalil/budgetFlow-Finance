const monthNames = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })

function transactionMonth(date) {
  return typeof date === 'string' ? date.slice(0, 7) : ''
}

export function getDashboardMetrics(transactions, now = new Date()) {
  const completed = transactions.filter(
    (transaction) => transaction.status === 'completed',
  )
  const totalIncome = completed
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const totalExpenses = completed
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  const year = now.getFullYear()
  const currentMonth = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthlyTotals = Array.from({ length: 12 }, (_, monthIndex) => {
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const monthTransactions = completed.filter(
      (transaction) => transactionMonth(transaction.date) === monthKey,
    )
    return {
      month: monthNames.format(new Date(Date.UTC(year, monthIndex, 1))),
      income: monthTransactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
      expense: monthTransactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    }
  })

  const categoryTotals = new Map()
  completed
    .filter(
      (transaction) =>
        transaction.type === 'expense' &&
        transactionMonth(transaction.date) === currentMonth,
    )
    .forEach((transaction) => {
      const category = transaction.category || 'Other'
      categoryTotals.set(
        category,
        (categoryTotals.get(category) || 0) + Number(transaction.amount || 0),
      )
    })

  const categoryColors = ['#155C4F', '#4E9B8D', '#F3A852', '#E87171', '#7B83C6', '#CBD5E1']
  const expensesByCategory = [...categoryTotals]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: categoryColors[index % categoryColors.length],
    }))

  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateOrder = String(b.date || '').localeCompare(String(a.date || ''))
      return dateOrder || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
    .slice(0, 5)

  return {
    totalIncome,
    totalExpenses,
    totalBalance: totalIncome - totalExpenses,
    savings: totalIncome - totalExpenses,
    monthlyTotals,
    expensesByCategory,
    recentTransactions,
    year,
    monthLabel: new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
    }).format(now),
  }
}
