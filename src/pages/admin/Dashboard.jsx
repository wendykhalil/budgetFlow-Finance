import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import SummaryCard from '@/components/layout/SummaryCard'
import BarChart from '@/components/charts/BarChart'
import Card from '@/components/ui/Card'
import { mockUsers } from '@/data/mockUsers'
import { getRegisteredUsers } from '@/data/registeredUsers'
import { transactions } from '@/data/mockTransactions'
import { budgets } from '@/data/mockBudgets'

export function AdminDashboard() {
  const allUsers = [...mockUsers, ...getRegisteredUsers()]
  const totalUsers = allUsers.length
  const activeUsers = allUsers.filter((u) => u.status === 'active').length
  const suspendedUsers = allUsers.filter((u) => u.status === 'suspended').length
  const inactiveUsers = totalUsers - activeUsers - suspendedUsers
  const totalTransactionVolume = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const formattedVolume = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalTransactionVolume)
  const stats = [
    { label: 'Total users', value: totalUsers.toLocaleString(), change: 'Mock records', icon: 'users', tone: 'bg-blue-50 text-blue-700' },
    { label: 'Active users', value: activeUsers.toLocaleString(), change: 'Mock records', icon: 'activity', tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total transactions', value: transactions.length.toLocaleString(), change: 'Mock records', icon: 'card', tone: 'bg-violet-50 text-violet-700' },
    { label: 'Transaction volume', value: formattedVolume, change: 'Mock records', icon: 'chart', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Total budgets', value: budgets.length.toLocaleString(), change: 'Mock records', icon: 'wallet', tone: 'bg-rose-50 text-rose-700' },
    { label: 'Monthly growth', value: 'Unavailable', change: 'No historical data', icon: 'report', tone: 'bg-cyan-50 text-cyan-700' },
  ]

  const chartData = [
    { month: 'May', income: 72, expense: 105 },
    { month: 'Jun', income: 64, expense: 115 },
    { month: 'Jul', income: 58, expense: 90 },
    { month: 'Aug', income: 45, expense: 110 },
    { month: 'Sep', income: 48, expense: 112 },
    { month: 'Oct', income: 68, expense: 95 },
  ]

  return (
    <>
      <PageTitle
        title="Administration dashboard"
        sub="Platform overview from current mock records; historical analytics and export are unavailable."
        action={
          <Button variant="secondary" size="sm" disabled title="Overview export is unavailable in this demo">
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <SummaryCard
            key={s.label}
            label={s.label}
            value={s.value}
            change={s.change}
            icon={s.icon}
            tone={s.tone}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="font-bold">Transaction volume</div>
          <div className="text-xs text-slate-400">Illustrative chart data</div>
          <div className="mt-7">
            <BarChart
              data={chartData}
              xAxisKey="month"
              bars={[
                { label: 'Income', dataKey: 'income', color: '#277666' },
                { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' },
              ]}
              height={200}
            />
          </div>
        </Card>
        <Card>
          <div className="font-bold">User activity</div>
          <div className="mt-6 space-y-5">
            {[
              ['Active users', activeUsers],
              ['Inactive users', inactiveUsers],
              ['Suspended', suspendedUsers],
            ].map(([label, value]) => {
              const pct = totalUsers ? (value / totalUsers) * 100 : 0
              return (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-emerald-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}

export default AdminDashboard
