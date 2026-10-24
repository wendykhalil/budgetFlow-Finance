import PageTitle from '@/components/layout/PageTitle'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'
import { transactions } from '@/data/mockTransactions'
import { formatCurrency } from '@/utils/formatters'

export function ClientAnalytics() {
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

  const incomeByCategory = [
    { name: 'Salary', value: 3850, color: '#277666' },
    { name: 'Freelance', value: 650, color: '#2563eb' },
    { name: 'Investments', value: 450, color: '#7c3aed' },
  ]

  const insights = [
    { label: 'Expenses decreased', value: '8.2%', desc: 'compared with last month', tone: 'green' },
    { label: 'Top spending', value: 'Housing', desc: '€750 this month', tone: 'amber' },
    { label: 'Savings rate', value: '44%', desc: '12% above your goal', tone: 'blue' },
  ]

  return (
    <>
      <PageTitle
        title="Financial analytics"
        sub="Understand your habits and make confident decisions."
        action={
          <Select
            options={[
              { value: '6m', label: 'Last 6 months' },
              { value: 'month', label: 'This month' },
              { value: 'year', label: 'This year' },
            ]}
            defaultValue="6m"
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((i) => (
          <Card key={i.label}>
            <Badge tone={i.tone}>{i.label}</Badge>
            <div className="mt-4 text-3xl font-bold">{i.value}</div>
            <div className="mt-1 text-sm text-slate-500">{i.desc}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="font-bold">Balance trend</div>
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
        </Card>

        <Card>
          <div className="font-bold">Income sources</div>
          <div className="text-xs text-slate-400">October 2026</div>
          <div className="mt-6">
            <DonutChart data={incomeByCategory} height={200} />
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <div className="font-bold">Monthly comparison</div>
          <div className="text-xs text-slate-400">vs. previous period</div>
          <div className="mt-7">
            <BarChart
              data={[
                { month: 'May', income: 72, expense: 105 },
                { month: 'Jun', income: 64, expense: 115 },
                { month: 'Jul', income: 58, expense: 90 },
                { month: 'Aug', income: 45, expense: 110 },
                { month: 'Sep', income: 48, expense: 112 },
                { month: 'Oct', income: 68, expense: 95 },
              ]}
              xAxisKey="month"
              bars={[
                { label: 'Income', dataKey: 'income', color: '#277666' },
                { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' },
              ]}
              height={200}
            />
          </div>
        </Card>
      </div>
    </>
  )
}

export default ClientAnalytics
