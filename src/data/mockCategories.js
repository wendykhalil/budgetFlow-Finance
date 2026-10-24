const categories = [
  { id: 'cat_001', name: 'Food', type: 'expense', color: '#4E9B8D', icon: 'tag', userId: 'usr_001' },
  { id: 'cat_002', name: 'Housing', type: 'expense', color: '#155C4F', icon: 'home', userId: 'usr_001' },
  { id: 'cat_003', name: 'Transport', type: 'expense', color: '#F3A852', icon: 'car', userId: 'usr_001' },
  { id: 'cat_004', name: 'Shopping', type: 'expense', color: '#E87171', icon: 'shopping-bag', userId: 'usr_001' },
  { id: 'cat_005', name: 'Utilities', type: 'expense', color: '#7B83C6', icon: 'zap', userId: 'usr_001' },
  { id: 'cat_006', name: 'Entertainment', type: 'expense', color: '#CBD5E1', icon: 'tv', userId: 'usr_001' },
  { id: 'cat_007', name: 'Healthcare', type: 'expense', color: '#EC4899', icon: 'heart', userId: 'usr_001' },
  { id: 'cat_008', name: 'Salary', type: 'income', color: '#277666', icon: 'trending-up', userId: 'usr_001' },
  { id: 'cat_009', name: 'Freelance', type: 'income', color: '#2563eb', icon: 'code', userId: 'usr_001' },
  { id: 'cat_010', name: 'Investments', type: 'income', color: '#7c3aed', icon: 'pie-chart', userId: 'usr_001' },
]

const expenseCategories = categories.filter((c) => c.type === 'expense')
const incomeCategories = categories.filter((c) => c.type === 'income')

const getCategoryById = (id) => categories.find((c) => c.id === id)
const getCategoryByName = (name) => categories.find((c) => c.name === name)

const mockCategories = {
  categories,
  expenseCategories,
  incomeCategories,
  getCategoryById,
  getCategoryByName,
}

export default mockCategories
export { categories, expenseCategories, incomeCategories, getCategoryById, getCategoryByName }
