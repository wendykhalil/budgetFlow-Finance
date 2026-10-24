const transactions = [
  {
    id: 'txn_001',
    date: '2026-10-05',
    description: 'Salary',
    category: 'Salary',
    type: 'income',
    amount: 3200.0,
    paymentMethod: 'Bank transfer',
    status: 'completed',
    userId: 'usr_001',
    note: 'October salary payment',
  },
  {
    id: 'txn_002',
    date: '2026-10-24',
    description: 'Grocery Store',
    category: 'Food',
    type: 'expense',
    amount: 86.4,
    paymentMethod: 'Debit card',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_003',
    date: '2026-10-23',
    description: 'Netflix',
    category: 'Entertainment',
    type: 'expense',
    amount: 15.99,
    paymentMethod: 'Credit card',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_004',
    date: '2026-10-20',
    description: 'Uber',
    category: 'Transport',
    type: 'expense',
    amount: 24.5,
    paymentMethod: 'Credit card',
    status: 'pending',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_005',
    date: '2026-10-18',
    description: 'Electricity Bill',
    category: 'Utilities',
    type: 'expense',
    amount: 72.3,
    paymentMethod: 'Bank transfer',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_006',
    date: '2026-10-16',
    description: 'Freelance Payment',
    category: 'Freelance',
    type: 'income',
    amount: 650.0,
    paymentMethod: 'Bank transfer',
    status: 'completed',
    userId: 'usr_001',
    note: 'Web design project',
  },
  {
    id: 'txn_007',
    date: '2026-10-12',
    description: 'Amazon',
    category: 'Shopping',
    type: 'expense',
    amount: 124.99,
    paymentMethod: 'Credit card',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_008',
    date: '2026-10-10',
    description: 'Rent Payment',
    category: 'Housing',
    type: 'expense',
    amount: 750.0,
    paymentMethod: 'Bank transfer',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_009',
    date: '2026-10-08',
    description: 'Pharmacy',
    category: 'Healthcare',
    type: 'expense',
    amount: 32.5,
    paymentMethod: 'Debit card',
    status: 'completed',
    userId: 'usr_001',
    note: '',
  },
  {
    id: 'txn_010',
    date: '2026-10-03',
    description: 'Investment Return',
    category: 'Investments',
    type: 'income',
    amount: 450.0,
    paymentMethod: 'Bank transfer',
    status: 'completed',
    userId: 'usr_001',
    note: 'Q3 dividend',
  },
]

const getTransactionsByUser = (userId) => transactions.filter((t) => t.userId === userId)

const getTransactionById = (id) => transactions.find((t) => t.id === id)

const getTotalIncome = (txnList = transactions) =>
  txnList.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)

const getTotalExpenses = (txnList = transactions) =>
  txnList.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    signDisplay: 'exceptZero',
  }).format(amount).replace(/\s/g, '\u00A0')
}

const formatAmount = (amount) => {
  const sign = amount >= 0 ? '+' : ''
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return `${sign}€${formatted}`
}

const mockTransactions = {
  transactions,
  getTransactionsByUser,
  getTransactionById,
  getTotalIncome,
  getTotalExpenses,
  formatCurrency,
  formatAmount,
}

export default mockTransactions
export {
  transactions,
  getTransactionsByUser,
  getTransactionById,
  getTotalIncome,
  getTotalExpenses,
  formatCurrency,
  formatAmount,
}
