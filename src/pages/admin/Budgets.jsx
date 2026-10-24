import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import SummaryCard from '@/components/layout/SummaryCard'
import BarChart from '@/components/charts/BarChart'

export function AdminBudgets() {
  const mockBudgets = [
    { id: 1, user: 'Alex Martin', category: 'Food', limit: 500, spent: 420, progress: 84 },
    { id: 2, user: 'Sarah Wilson', category: 'Transport', limit: 350, spent: 280, progress: 80 },
    { id: 3, user: 'John Smith', category: 'Shopping', limit: 300, spent: 286, progress: 95 },
    { id: 4, user: 'Emma Johnson', category: 'Housing', limit: 750, spent: 750, progress: 100 },
    { id: 5, user: 'Michael Brown', category: 'Entertainment', limit: 250, spent: 295, progress: 118 },
    { id: 6, user: 'Alex Martin', category: 'Utilities', limit: 300, spent: 240, progress: 80 },
  ]

  return (
    <>
      <PageTitle
        title="Budgets"
        sub="Monitor platform-wide budget allocations and spending."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total budgets" value="4,820" change="+9.3%" icon="wallet" tone="bg-rose-50 text-rose-700" />
        <SummaryCard label="Healthy" value="3,384" change="70.2%" icon="check" tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Exceeded" value="482" change="+5.1%" icon="alert-triangle" tone="bg-rose-50 text-rose-700" />
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
            {mockBudgets.map((b) => {
              const remaining = b.limit - b.spent
              const isExceeded = b.progress >= 100
              return (
                <tr key={b.id}>
                  <td className="flex items-center gap-3 px-5 py-4">
                    <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                      AM
                    </span>
                    {b.user}
                  </td>
                  <td className="px-5 py-4 font-semibold">{b.category}</td>
                  <td className="px-5 py-4">€{b.limit.toLocaleString()}</td>
                  <td className="px-5 py-4">€{b.spent.toLocaleString()}</td>
                  <td className={`px-5 py-4 font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    €{remaining.toLocaleString()}
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
                    <Button variant="ghost" size="sm">View</Button>
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
