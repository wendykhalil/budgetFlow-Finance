import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'
import SummaryCard from '@/components/layout/SummaryCard'
import BarChart from '@/components/charts/BarChart'
import Card from '@/components/ui/Card'
import { mockUsers } from '@/data/mockUsers'

export function AdminDashboard() {
  const totalUsers = mockUsers.length
  const activeUsers = mockUsers.filter((u) => u.status === 'active').length
  const stats = [
    { label: 'Total users', value: totalUsers.toLocaleString(), change: '+12.4%', icon: 'users', tone: 'bg-blue-50 text-blue-700' },
    { label: 'Active users', value: activeUsers.toLocaleString(), change: '+8.6%', icon: 'activity', tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Total transactions', value: '48,920', change: '+15.2%', icon: 'card', tone: 'bg-violet-50 text-violet-700' },
    { label: 'Transaction volume', value: '€3,845,620', change: '+11.8%', icon: 'chart', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Total budgets', value: '4,820', change: '+9.3%', icon: 'wallet', tone: 'bg-rose-50 text-rose-700' },
    { label: 'Monthly growth', value: '12.4%', change: '+3.1%', icon: 'report', tone: 'bg-cyan-50 text-cyan-700' },
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
        sub="Platform health and activity overview for October 2026."
        action={
          <Button variant="secondary" size="sm">
            <Icon name="download" className="size-4" /> Export overview
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
              ['Active users', '2,214', 87],
              ['Inactive users', '286', 11],
              ['Suspended', '48', 2],
            ].map(([label, value, pct]) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-emerald-600" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

export default AdminDashboard
