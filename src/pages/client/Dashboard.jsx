import { useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"

import { useTransactions } from "@/contexts/TransactionContext"

import { useBudgets } from "@/contexts/BudgetContext"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import SummaryCard from "@/components/layout/SummaryCard"

import BarChart from "@/components/charts/BarChart"

import DonutChart from "@/components/charts/DonutChart"

import Progress from "@/components/ui/Progress"

import {
  formatCurrency,
  formatPercent,
  formatUserCurrency,
} from "@/utils/formatters"

import { getDashboardMetrics } from "@/utils/dashboardMetrics"
import { formatCalendarDate } from "@/utils/calendarDates"
import { getLocalDateString } from "@/utils/calendarDates"

const budgetStatusTones = {
  healthy: "green",
  warning: "amber",
  exceeded: "red",
}

function getBudgetUpdatedTime(budget) {
  const updated = Date.parse(budget.updatedAt || budget.createdAt || "")
  return Number.isFinite(updated) ? updated : 0
}

function getTopCurrentMonthBudgets(budgets, month) {
  return budgets
    .filter(
      (budget) =>
        typeof budget.startDate === "string" &&
        budget.startDate.slice(0, 7) === month &&
        typeof budget.spending?.percentUsed === "number",
    )
    .slice()
    .sort(
      (left, right) =>
        right.spending.percentUsed - left.spending.percentUsed ||
        getBudgetUpdatedTime(right) - getBudgetUpdatedTime(left) ||
        String(left.id).localeCompare(String(right.id)),
    )
    .slice(0, 3)
}

export function ClientDashboard() {
  const navigate = useNavigate()

  const { user } = useAuth()

  const {
    transactions,

    loading,

    error,

    refreshTransactions,
  } = useTransactions()

  const {
    budgets,
    loading: budgetsLoading,
    error: budgetsError,
    refreshBudgets,
  } = useBudgets()

  const metrics = getDashboardMetrics(transactions)

  const currency = user?.currency || "EUR"

  const currentMonth = getLocalDateString().slice(0, 7)
  const topBudgets = getTopCurrentMonthBudgets(budgets, currentMonth)

  const dataAvailable = !loading || transactions.length > 0

  const displayAmount = (amount) =>
    dataAvailable ? formatUserCurrency(amount, currency) : "—"

  return (
    <>
      <PageTitle
        title={`Good morning, ${user?.firstName?.trim() || "there"}`}
        sub={`Here's your financial overview for ${metrics.monthLabel}.`}
        action={
          <Button onClick={() => navigate("/client/transactions/new")}>
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
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshTransactions}
            disabled={loading}
          >
            Retry
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total balance"
          value={displayAmount(metrics.totalBalance)}
          icon="wallet"
          tone="bg-emerald-50 text-emerald-700"
        />
        <SummaryCard
          label="Total income"
          value={displayAmount(metrics.totalIncome)}
          icon="chart"
          tone="bg-blue-50 text-blue-700"
        />
        <SummaryCard
          label="Total expenses"
          value={displayAmount(metrics.totalExpenses)}
          icon="card"
          tone="bg-rose-50 text-rose-600"
        />
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
              <div
                role="status"
                className="grid h-[200px] place-items-center text-sm text-slate-500"
              >
                Loading chart...
              </div>
            ) : (
              <BarChart
                data={metrics.monthlyTotals}
                xAxisKey="month"
                bars={[
                  { label: "Income", dataKey: "income", color: "#277666" },

                  { label: "Expenses", dataKey: "expense", color: "#D9E4E1" },
                ]}
                currency={currency}
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
                  metrics.expensesByCategory.reduce(
                    (sum, item) => sum + item.value,
                    0,
                  ),

                  currency,
                )}
                innerSubtext="Total spent"
                currency={currency}
                height={200}
              />
            ) : (
              <div className="grid h-[200px] place-items-center text-center text-sm text-slate-500">
                {loading && transactions.length === 0
                  ? "Loading expenses..."
                  : "No completed expenses this month."}
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
              <div className="text-xs text-slate-400">
                Your latest account activity
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/client/transactions")}
            >
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
                        <div className="text-xs text-slate-500">
                          {formatDate(transaction.date)}
                        </div>
                        <div className="font-semibold">
                          {transaction.description}
                        </div>
                        <Badge
                          tone={
                            (transaction.status || "completed") === "completed"
                              ? "green"
                              : "amber"
                          }
                          size="sm"
                        >
                          {(transaction.status || "completed") === "completed"
                            ? "Completed"
                            : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone="neutral" size="sm">
                          {transaction.category}
                        </Badge>
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-bold ${
                          transaction.type === "income"
                            ? "text-emerald-600"
                            : "text-slate-800"
                        }`}
                      >
                        {formatUserCurrency(
                          transaction.type === "expense"
                            ? -transaction.amount
                            : transaction.amount,

                          currency,
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-sm text-slate-500"
                    >
                      {loading
                        ? "Loading transactions..."
                        : "No transactions yet. Add one to get started."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">Budget progress</div>
              <div className="text-xs text-slate-400">{metrics.monthLabel}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/client/budgets")}
            >
              View all
            </Button>
          </div>

          {budgetsLoading ? (
            <div
              role="status"
              className="mt-6 grid min-h-40 place-items-center text-sm text-slate-500"
            >
              Loading budgets...
            </div>
          ) : budgetsError ? (
            <div className="mt-6 grid min-h-40 place-items-center gap-3 text-center">
              <p role="alert" className="text-sm text-rose-700">
                {budgetsError}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={refreshBudgets}
                disabled={budgetsLoading}
              >
                Retry
              </Button>
            </div>
          ) : topBudgets.length === 0 ? (
            <div className="mt-6 grid min-h-40 place-items-center gap-3 text-center">
              <p className="text-sm text-slate-500">
                No budgets for this month yet.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/client/budgets/new")}
              >
                Create a budget
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {topBudgets.map((budget) => {
                const spending = budget.spending
                const percentUsed = spending.percentUsed
                const status = budgetStatusTones[spending.status]
                  ? spending.status
                  : "healthy"

                return (
                  <div key={budget.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {budget.categoryId?.name || "Archived category"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(spending.spent, currency)} of{" "}
                          {formatCurrency(spending.limit, currency)}
                        </p>
                      </div>
                      <Badge tone={budgetStatusTones[status]} size="sm">
                        {status}
                      </Badge>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${budget.categoryId?.name || "Archived category"} budget usage`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(Math.max(percentUsed, 0), 100)}
                    >
                      <Progress
                        value={Math.max(percentUsed, 0)}
                        color={
                          status === "exceeded"
                            ? "rose"
                            : status === "warning"
                              ? "amber"
                              : "emerald"
                        }
                      />
                    </div>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="font-medium text-slate-600">
                        {formatPercent(percentUsed)} used
                      </span>
                      <span className="text-slate-500">
                        {formatCurrency(spending.remaining, currency)} remaining
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => navigate("/client/budgets")}
          >
            Manage budgets
          </Button>
        </Card>
      </div>
    </>
  )
}

function formatDate(dateString) {
  return formatCalendarDate(dateString, "en-GB", {
    year: "numeric",

    month: "short",

    day: "numeric",
  })
}

export default ClientDashboard
