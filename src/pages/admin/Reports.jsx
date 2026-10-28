import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import SummaryCard from '@/components/layout/SummaryCard'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'

export function AdminReports() {
  const statCards = [
    { label: 'Total revenue', value: '€3.84M', change: '+12.4%', icon: 'activity', tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Avg. transaction', value: '€78.61', change: '+2.1%', icon: 'card', tone: 'bg-blue-50 text-blue-700' },
    { label: 'Monthly users', value: '2,214', change: '+8.7%', icon: 'users', tone: 'bg-amber-50 text-amber-700' },
    { label: 'Platform growth', value: '12.4%', change: '+3.2%', icon: 'chart', tone: 'bg-indigo-50 text-indigo-700' },
  ]

  const chartData = [
    { month: 'Jan', income: 45, expense: 52 },
    { month: 'Feb', income: 52, expense: 48 },
    { month: 'Mar', income: 48, expense: 55 },
    { month: 'Apr', income: 60, expense: 50 },
    { month: 'May', income: 55, expense: 48 },
    { month: 'Jun', income: 68, expense: 56 },
    { month: 'Jul', income: 72, expense: 60 },
    { month: 'Aug', income: 65, expense: 58 },
    { month: 'Sep', income: 70, expense: 62 },
    { month: 'Oct', income: 78, expense: 65 },
  ]

  const categoryData = [
    { name: 'Housing', value: 30, color: '#155C4F' },
    { name: 'Food', value: 18, color: '#4E9B8D' },
    { name: 'Transport', value: 12, color: '#F3A852' },
    { name: 'Shopping', value: 14, color: '#E87171' },
    { name: 'Entertainment', value: 9, color: '#CBD5E1' },
    { name: 'Other', value: 17, color: '#7B83C6' },
  ]

  return (
    <>
      <PageTitle
        title="Reports & analytics"
        sub="Illustrative mock analytics. Date filtering and live reporting are unavailable."
        action={
          <Button disabled title="Report export is unavailable in this demo">
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <input
            aria-label="Start date"
            type="date"
            disabled
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
            defaultValue="2026-10-01"
          />
          <input
            aria-label="End date"
            type="date"
            disabled
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-60"
            defaultValue="2026-10-31"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((s) => (
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
          <div className="text-xs text-slate-400">January – October 2026</div>
          <div className="mt-7">
            <BarChart
              data={chartData}
              xAxisKey="month"
              bars={[{ label: 'Income', dataKey: 'income', color: '#277666' }, { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' }]}
              height={250}
            />
          </div>
        </Card>

        <Card>
          <div className="font-bold">Category distribution</div>
          <div className="text-xs text-slate-400">By spending volume</div>
          <div className="mt-6">
            <DonutChart data={categoryData} innerText="€3.84M" innerSubtext="Total volume" height={250} />
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <div className="font-bold">Income vs expenses trend</div>
          <div className="text-xs text-slate-400">YoY comparison</div>
          <div className="mt-7">
            <BarChart
              data={[
                { month: 'Oct 2025', income: 58, expense: 62 },
                { month: 'Nov 2025', income: 62, expense: 65 },
                { month: 'Dec 2025', income: 72, expense: 60 },
                { month: 'Jan 2026', income: 55, expense: 52 },
                { month: 'Feb 2026', income: 52, expense: 48 },
                { month: 'Oct 2026', income: 78, expense: 65 },
              ]}
              xAxisKey="month"
              bars={[
                { label: 'Income', dataKey: 'income', color: '#277666' },
                { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' },
              ]}
              height={250}
            />
          </div>
        </Card>
      </div>
    </>
  )
}

export default AdminReports
