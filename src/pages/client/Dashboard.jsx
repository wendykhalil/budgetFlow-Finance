import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import SummaryCard from '@/components/layout/SummaryCard'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'
import { transactions, formatAmount } from '@/data/mockTransactions'
import { budgets } from '@/data/mockBudgets'
import { formatCurrency } from '@/utils/formatters'

export function ClientDashboard() {
  const navigate = useNavigate()

  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalBalance = totalIncome - totalExpenses

  const recentTransactions = transactions.slice(0, 5)

  const incomeData = [
    { month: 'May', income: 72, expense: 105 },
    { month: 'Jun', income: 64, expense: 115 },
    { month: 'Jul', income: 58, expense: 90 },
    { month: 'Aug', income: 45, expense: 110 },
    { month: 'Sep', income: 48, expense: 112 },
    { month: 'Oct', income: 33, expense: 118 },
  ]

  const donutData = [
    { name: 'Housing', value: 750, color: '#155C4F' },
    { name: 'Food', value: 420, color: '#4E9B8D' },
    { name: 'Transport', value: 280, color: '#F3A852' },
    { name: 'Shopping', value: 260, color: '#E87171' },
    { name: 'Utilities', value: 240, color: '#7B83C6' },
    { name: 'Other', value: 190, color: '#CBD5E1' },
  ]

  const budgetProgress = budgets.slice(0, 6)

  return (
    <>
      <PageTitle
        title="Good morning, Alex"
        sub="Here's your financial overview for October 2026."
        action={
          <Button onClick={() => navigate('/client/transactions/new')}>
            <Icon name="plus" className="size-4" /> Add transaction
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total balance" value={formatCurrency(totalBalance)} change="+8.4%" icon="wallet" tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Total income" value={formatCurrency(totalIncome)} change="+5.2%" icon="chart" tone="bg-blue-50 text-blue-700" />
        <SummaryCard label="Total expenses" value={formatCurrency(totalExpenses)} change="-4.2%" icon="card" tone="bg-rose-50 text-rose-600" />
        <SummaryCard label="Savings" value={formatCurrency(totalBalance)} change="+12.1%" icon="activity" tone="bg-amber-50 text-amber-700" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Income vs expenses</div>
              <div className="text-xs text-slate-400">May – October 2026</div>
            </div>
            <Badge tone="neutral">This year</Badge>
          </div>
          <div className="mt-7">
            <BarChart
              data={incomeData}
              xAxisKey="month"
              bars={[
                { label: 'Income', dataKey: 'income', color: '#277666' },
                { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' },
              ]}
              height={200}
            />
          </div>
          <div className="mt-5 flex justify-center gap-6 text-xs">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-[#277666]" /> Income
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-[#D9E4E1]" /> Expenses
            </span>
          </div>
        </Card>

        <Card>
          <div className="font-bold">Expenses by category</div>
          <div className="text-xs text-slate-400">October 2026</div>
          <div className="mt-6">
            <DonutChart
              data={donutData}
              innerText="€2,140"
              innerSubtext="Total spent"
              height={200}
            />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="font-bold">Recent transactions</div>
              <div className="text-xs text-slate-400">Your latest account activity</div>
            </div>
            <Button variant="ghost" size="sm">
              View all <Icon name="arrow" className="size-4" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {recentTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="text-xs text-slate-500">{formatDate(t.date)}</div>
                      <div className="font-semibold">{t.description}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone="neutral" size="sm">{t.category}</Badge>
                    </td>
                    <td className={`px-5 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {formatAmount(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="font-bold">Budget progress</div>
          <div className="text-xs text-slate-400">October spending limits</div>
          <div className="mt-6 space-y-5">
            {budgetProgress.map((b) => {
              const progress = (b.spent / b.limit) * 100
              const isExceeded = progress >= 100
              const isWarning = progress >= 85 && progress < 100
              return (
                <div key={b.id}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-semibold">{b.name}</span>
                    <span className="text-slate-500">{formatCurrency(b.spent)} / {formatCurrency(b.limit)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-[#277666]'}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <Button variant="secondary" className="mt-6 w-full">
            Manage budgets
          </Button>
        </Card>
      </div>
    </>
  )
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' }
  return new Date(dateString).toLocaleDateString('en-GB', options)
}

export default ClientDashboard
