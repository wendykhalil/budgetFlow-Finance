import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTransactions } from '@/contexts/TransactionContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import SummaryCard from '@/components/layout/SummaryCard'
import BarChart from '@/components/charts/BarChart'
import DonutChart from '@/components/charts/DonutChart'
import { formatUserCurrency } from '@/utils/formatters'
import { getDashboardMetrics } from '@/utils/dashboardMetrics'

export function ClientDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    transactions,
    loading,
    error,
    refreshTransactions,
  } = useTransactions()
  const metrics = getDashboardMetrics(transactions)
  const currency = user?.currency || 'EUR'
  const dataAvailable = !loading || transactions.length > 0
  const displayAmount = (amount) =>
    dataAvailable ? formatUserCurrency(amount, currency) : '—'

  return (
    <>
      <PageTitle
        title={`Good morning, ${user?.firstName?.trim() || 'there'}`}
        sub={`Here's your financial overview for ${metrics.monthLabel}.`}
        action={
          <Button onClick={() => navigate('/client/transactions/new')}>
            <Icon name="plus" className="size-4" /> Add transaction
          </Button>
        }
      />

      {loading && transactions.length === 0 && (
        <p role="status" className="mb-4 text-sm text-slate-500">
          Loading financial data...
        </p>
      )}
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span role="alert">{error}</span>
          <Button variant="secondary" size="sm" onClick={refreshTransactions} disabled={loading}>
            Retry
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total balance" value={displayAmount(metrics.totalBalance)} icon="wallet" tone="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="Total income" value={displayAmount(metrics.totalIncome)} icon="chart" tone="bg-blue-50 text-blue-700" />
        <SummaryCard label="Total expenses" value={displayAmount(metrics.totalExpenses)} icon="card" tone="bg-rose-50 text-rose-600" />
        <SummaryCard
          label="Net savings"
          value={displayAmount(metrics.savings)}
          icon="activity"
          tone="bg-amber-50 text-amber-700"
          subtitle="Completed income minus expenses"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">Income vs expenses</div>
              <div className="text-xs text-slate-400">{metrics.year}</div>
            </div>
            <Badge tone="neutral">This year</Badge>
          </div>
          <div className="mt-7">
            {loading && transactions.length === 0 ? (
              <div role="status" className="grid h-[200px] place-items-center text-sm text-slate-500">
                Loading chart...
              </div>
            ) : (
              <BarChart
                data={metrics.monthlyTotals}
                xAxisKey="month"
                bars={[
                  { label: 'Income', dataKey: 'income', color: '#277666' },
                  { label: 'Expenses', dataKey: 'expense', color: '#D9E4E1' },
                ]}
                height={200}
              />
            )}
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
          <div className="text-xs text-slate-400">{metrics.monthLabel}</div>
          <div className="mt-6">
            {metrics.expensesByCategory.length > 0 ? (
              <DonutChart
                data={metrics.expensesByCategory}
                innerText={formatUserCurrency(
                  metrics.expensesByCategory.reduce((sum, item) => sum + item.value, 0),
                  currency,
                )}
                innerSubtext="Total spent"
                height={200}
              />
            ) : (
              <div className="grid h-[200px] place-items-center text-center text-sm text-slate-500">
                {loading && transactions.length === 0
                  ? 'Loading expenses...'
                  : 'No completed expenses this month.'}
              </div>
            )}
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/client/transactions')}>
              View all <Icon name="arrow" className="size-4" />
            </Button>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.recentTransactions.length > 0 ? (
                  metrics.recentTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="text-xs text-slate-500">{formatDate(transaction.date)}</div>
                        <div className="font-semibold">{transaction.description}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone="neutral" size="sm">{transaction.category}</Badge>
                      </td>
                      <td className={`px-5 py-4 text-right font-bold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {formatUserCurrency(
                          transaction.type === 'expense' ? -transaction.amount : transaction.amount,
                          currency,
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">
                      {loading ? 'Loading transactions...' : 'No transactions yet. Add one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="font-bold">Budget progress</div>
          <div className="text-xs text-slate-400">Budget service</div>
          <div className="mt-6 grid min-h-40 place-items-center text-center text-sm text-slate-500">
            Budget progress is not available from the connected services yet.
          </div>
          <Button variant="secondary" className="mt-6 w-full" onClick={() => navigate('/client/budgets')}>
            Manage budgets
          </Button>
        </Card>
      </div>
    </>
  )
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default ClientDashboard
