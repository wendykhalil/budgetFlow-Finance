import PageTitle from "@/components/layout/PageTitle"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Select from "@/components/ui/Select"
import Alert from "@/components/ui/Alert"
import LoadingSkeleton from "@/components/ui/LoadingSkeleton"
import BarChart from "@/components/charts/BarChart"
import DonutChart from "@/components/charts/DonutChart"
import { formatUserCurrency } from "@/utils/formatters"
import { useAuth } from "@/contexts/AuthContext"
import { useAnalytics } from "@/hooks/useAnalytics"

export function ClientAnalytics() {
  const { user } = useAuth()
  const currency = user?.currency || "EUR"
  const { data, loading, error, refetch } = useAnalytics()

  if (loading) {
    return (
      <>
        <PageTitle
          title="Financial analytics"
          sub="Understand your habits and make confident decisions."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <LoadingSkeleton height={120} />
            </Card>
          ))}
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Card>
            <LoadingSkeleton height={300} />
          </Card>
          <Card>
            <LoadingSkeleton height={300} />
          </Card>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageTitle
          title="Financial analytics"
          sub="Understand your habits and make confident decisions."
        />
        <Alert
          variant="error"
          title="Failed to load analytics"
          description={error}
          action={{ label: "Retry", onClick: refetch }}
        />
      </>
    )
  }

  if (!data) {
    return (
      <>
        <PageTitle
          title="Financial analytics"
          sub="Understand your habits and make confident decisions."
        />
        <Alert
          variant="info"
          title="No data available"
          description="Start adding transactions to see your financial analytics."
        />
      </>
    )
  }

  const {
    monthlyBalance = [],
    expensesByCategory = [],
    incomeByCategory = [],
    insights: apiInsights = {},
  } = data

  // Mapper les insights de l'API vers le format UI
  const monthOverMonthPercent = apiInsights.monthOverMonthChange || 0
  const monthOverMonthSign = monthOverMonthPercent > 0 ? "↓" : "↑"
  const monthOverMonthTone = monthOverMonthPercent > 0 ? "green" : "red"

  const insights = [
    {
      label:
        "Expenses " + (monthOverMonthPercent > 0 ? "decreased" : "increased"),
      value: `${Math.abs(monthOverMonthPercent)}%`,
      desc: "compared with last month",
      tone: monthOverMonthTone,
    },
    {
      label: "Top spending",
      value: apiInsights.topSpendingCategory || "—",
      desc: `${formatUserCurrency(apiInsights.topSpendingAmount || 0, currency)} this month`,
      tone: "amber",
    },
    {
      label: "Savings rate",
      value: `${apiInsights.savingsRate || 0}%`,
      desc: "of your income saved",
      tone: "blue",
    },
  ]

  return (
    <>
      <PageTitle
        title="Financial analytics"
        sub="Understand your habits and make confident decisions."
        action={
          <Select
            label="Analytics period (preview only)"
            disabled
            options={[
              { value: "6m", label: "Last 6 months" },
              { value: "month", label: "This month" },
              { value: "year", label: "This year" },
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
            {monthlyBalance.length > 0 ? (
              <BarChart
                data={monthlyBalance}
                xAxisKey="month"
                bars={[
                  { label: "Income", dataKey: "income", color: "#277666" },
                  { label: "Expenses", dataKey: "expense", color: "#D9E4E1" },
                ]}
                currency={currency}
                height={200}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-400">
                No transaction data for the last 6 months
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="font-bold">Income sources</div>
          <div className="text-xs text-slate-400">This month</div>
          <div className="mt-6">
            {incomeByCategory.length > 0 ? (
              <DonutChart
                data={incomeByCategory}
                innerText={formatUserCurrency(
                  incomeByCategory.reduce((sum, item) => sum + item.value, 0),
                  currency,
                )}
                innerSubtext="Total income"
                currency={currency}
                height={200}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-400">
                No income transactions this month
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Card>
          <div className="font-bold">Expenses by category</div>
          <div className="text-xs text-slate-400">This month</div>
          <div className="mt-7">
            {expensesByCategory.length > 0 ? (
              <DonutChart
                data={expensesByCategory}
                innerText={formatUserCurrency(
                  expensesByCategory.reduce((sum, item) => sum + item.value, 0),
                  currency,
                )}
                innerSubtext="Total expenses"
                currency={currency}
                height={200}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-400">
                No expense transactions this month
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

export default ClientAnalytics
