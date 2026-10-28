import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { budgets } from '@/data/mockBudgets'
import { categories } from '@/data/mockCategories'

export function BudgetNew() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [limit, setLimit] = useState('')
  const [category, setCategory] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !limit) return

    const newBudget = {
      id: `bud_${Date.now()}`,
      name,
      category,
      limit: parseFloat(limit),
      spent: 0,
      color: '#277666',
      icon: 'tag',
      userId: 'usr_001',
      period: 'monthly',
    }

    budgets.unshift(newBudget)
    navigate('/client/budgets')
  }

  const categoryOptions = categories
    .filter((c) => c.type === 'expense')
    .map((c) => ({ value: c.name, label: c.name }))

  return (
    <>
      <PageTitle
        title="Create budget"
        sub="Set a spending limit and track your progress."
        action={
          <Button variant="secondary" onClick={() => navigate('/client/budgets')}>
            Cancel
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="budget-name" className="text-sm font-semibold text-slate-700">Name</label>
              <input
                id="budget-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                placeholder="Food budget"
              />
            </div>
            <div>
              <label htmlFor="budget-category" className="text-sm font-semibold text-slate-700">Category</label>
              <select
                id="budget-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
              >
                <option value="">Select category</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="budget-limit" className="text-sm font-semibold text-slate-700">Budget limit</label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                <input
                  id="budget-limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-10 text-sm text-slate-900 outline-none focus:border-emerald-600"
                  placeholder="500.00"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" onClick={() => navigate('/client/budgets')}>
              Cancel
            </Button>
            <Button type="submit">Create budget</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

export default BudgetNew
