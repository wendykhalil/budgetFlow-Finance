import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import SummaryCard from '@/components/layout/SummaryCard'
import { budgets } from '@/data/mockBudgets'
import { getUserById } from '@/data/mockUsers'
import { getRegisteredUsers } from '@/data/registeredUsers'

export function AdminBudgets() {
  const registeredUsers = getRegisteredUsers()
  const platformBudgets = budgets.map((budget) => {
    const owner = getUserById(budget.userId) || registeredUsers.find((user) => user.id === budget.userId)
    return {
      ...budget,
      user: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown user',
      avatar: owner?.avatar || '—',
      progress: (budget.spent / budget.limit) * 100,
    }
  })
  const healthyCount = platformBudgets.filter((budget) => budget.progress < 85).length
  const exceededCount = platformBudgets.filter((budget) => budget.progress >= 100).length

  return (
    <>
      <PageTitle
        title="Budgets"
        sub="Monitor platform-wide budget allocations and spending."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total budgets" value={platformBudgets.length.toLocaleString()} change="Current mock records" icon="wallet" tone="bg-rose-50 text-rose-700" />
        <SummaryCard label="Healthy" value={healthyCount.toLocaleString()} change="Current mock records" icon="check" tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Exceeded" value={exceededCount.toLocaleString()} change="Current mock records" icon="alert-triangle" tone="bg-rose-50 text-rose-700" />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['User', 'Category', 'Budget Limit', 'Spending', 'Remaining', 'Progress', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {platformBudgets.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">No budgets are available.</td></tr>
            ) : platformBudgets.map((b) => {
              const remaining = b.limit - b.spent
              const isExceeded = b.progress >= 100
              return (
                <tr key={b.id}>
                  <td className="flex items-center gap-3 px-5 py-4">
                    <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800" aria-hidden="true">
                      {b.avatar}
                    </span>
                    {b.user}
                  </td>
                  <td className="px-5 py-4 font-semibold">{b.category}</td>
                  <td className="px-5 py-4">€{b.limit.toLocaleString()}</td>
                  <td className="px-5 py-4">€{b.spent.toLocaleString()}</td>
                  <td className={`px-5 py-4 font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(remaining)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-2 w-20 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${isExceeded ? 'bg-rose-500' : b.progress >= 85 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${Math.min(b.progress, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold ${isExceeded ? 'text-rose-600' : b.progress >= 85 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {isExceeded ? 'Exceeded' : b.progress >= 85 ? 'Warning' : 'Healthy'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Button variant="ghost" size="sm" disabled title="Budget details are unavailable in admin view">View unavailable</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default AdminBudgets
