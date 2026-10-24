const budgets = [
  {
    id: 'bud_001',
    name: 'Food',
    category: 'Food',
    limit: 500,
    spent: 420,
    color: '#4E9B8D',
    icon: 'tag',
    userId: 'usr_001',
    period: 'monthly',
  },
  {
    id: 'bud_002',
    name: 'Transport',
    category: 'Transport',
    limit: 350,
    spent: 280,
    color: '#F3A852',
    icon: 'car',
    userId: 'usr_001',
    period: 'monthly',
  },
  {
    id: 'bud_003',
    name: 'Entertainment',
    category: 'Entertainment',
    limit: 250,
    spent: 190,
    color: '#CBD5E1',
    icon: 'tv',
    userId: 'usr_001',
    period: 'monthly',
  },
  {
    id: 'bud_004',
    name: 'Shopping',
    category: 'Shopping',
    limit: 300,
    spent: 286,
    color: '#E87171',
    icon: 'shopping-bag',
    userId: 'usr_001',
    period: 'monthly',
  },
  {
    id: 'bud_005',
    name: 'Housing',
    category: 'Housing',
    limit: 750,
    spent: 750,
    color: '#155C4F',
    icon: 'home',
    userId: 'usr_001',
    period: 'monthly',
  },
  {
    id: 'bud_006',
    name: 'Travel',
    category: 'Shopping',
    limit: 400,
    spent: 430,
    color: '#E87171',
    icon: 'plane',
    userId: 'usr_001',
    period: 'monthly',
  },
]

const getBudgetsByUser = (userId) => budgets.filter((b) => b.userId === userId)

const getBudgetById = (id) => budgets.find((b) => b.id === id)

const getBudgetStatus = (budget) => {
  const progress = (budget.spent / budget.limit) * 100
  if (progress >= 100) return 'exceeded'
  if (progress >= 85) return 'warning'
  return 'healthy'
}

const getBudgetProgress = (budget) => {
  const progress = (budget.spent / budget.limit) * 100
  return Math.min(progress, 100)
}

const mockBudgets = {
  budgets,
  getBudgetsByUser,
  getBudgetById,
  getBudgetStatus,
  getBudgetProgress,
}

export default mockBudgets
export { budgets, getBudgetsByUser, getBudgetById, getBudgetStatus, getBudgetProgress }
