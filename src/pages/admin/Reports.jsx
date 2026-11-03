import { useEffect, useMemo, useState } from "react"

import PageTitle from "@/components/layout/PageTitle"

import SummaryCard from "@/components/layout/SummaryCard"

import BarChart from "@/components/charts/BarChart"

import DonutChart from "@/components/charts/DonutChart"

import Alert from "@/components/ui/Alert"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import { useAuth } from "@/contexts/AuthContext"

import { apiRequest } from "@/lib/api"

import { SUPPORTED_CURRENCIES } from "@/utils/currencies"

import { formatUserCurrency } from "@/utils/formatters"

const categoryColors = [
  "#155C4F",
  "#4E9B8D",
  "#F3A852",
  "#E87171",
  "#7B83C6",
  "#CBD5E1",
]

const supportedCurrencyCodes = new Set(
  SUPPORTED_CURRENCIES.map(({ code }) => code),
)

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function validateCategoryReport(response) {
  if (
    !response ||
    !Array.isArray(response.data) ||
    !response.summary ||
    !isNonNegativeInteger(response.summary.totalTransactions) ||
    response.data.some(
      (row) =>
        !row ||
        typeof row.category !== "string" ||
        !Number.isInteger(row.transactionCount) ||
        row.transactionCount < 1,
    ) ||
    response.data.reduce((total, row) => total + row.transactionCount, 0) !==
      response.summary.totalTransactions
  ) {
    throw new Error("The category report returned an unexpected response.")
  }

  return response
}

function validateUserSpendingReport(response) {
  if (
    !response ||
    !Array.isArray(response.data) ||
    !response.summary ||
    !isNonNegativeInteger(response.summary.totalUsers) ||
    !isNonNegativeInteger(response.summary.totalTransactions) ||
    response.data.some(
      (row) =>
        !row ||
        typeof row.userId !== "string" ||
        !supportedCurrencyCodes.has(row.currency) ||
        !["income", "expense", "totalAmount"].every(
          (field) =>
            typeof row[field] === "number" &&
            Number.isFinite(row[field]) &&
            row[field] >= 0,
        ) ||
        !isNonNegativeInteger(row.transactionCount),
    ) ||
    response.summary.totalUsers !== response.data.length ||
    response.summary.totalTransactions !==
      response.data.reduce((total, row) => total + row.transactionCount, 0)
  ) {
    throw new Error(
      "The user spending report returned incomplete or unexpected data.",
    )
  }

  return response
}

function reportParams(startDate, endDate, limit) {
  const params = new URLSearchParams()

  if (startDate) params.set("startDate", startDate)

  if (endDate) params.set("endDate", endDate)

  if (limit) params.set("limit", String(limit))

  const query = params.toString()

  return query ? `?${query}` : ""
}

function formatCount(value) {
  return new Intl.NumberFormat("en-GB").format(value)
}

function ReportStatus({ report, emptyMessage }) {
  if (report.status === "loading") {
    return (
      <p role="status" className="py-8 text-center text-sm text-slate-500">
        Loading report…
      </p>
    )
  }

  if (report.status === "error") {
    return (
      <Alert
        className="mt-5"
        type="error"
        title="Report unavailable"
        message={report.error}
      />
    )
  }

  if (report.data.data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
    )
  }

  return null
}

function UserCurrencyReport({ currency, users }) {
  const chartData = users.map((user) => ({
    label:
      user.email ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.userId,

    expense: user.expense,
  }))

  const totals = users.reduce(
    (result, user) => ({
      income: result.income + user.income,

      expense: result.expense + user.expense,

      totalAmount: result.totalAmount + user.totalAmount,

      transactions: result.transactions + user.transactionCount,
    }),

    { income: 0, expense: 0, totalAmount: 0, transactions: 0 },
  )

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">
            Spending by user · {currency}
          </h3>
          <p className="text-xs text-slate-500">
            Completed expenses for returned users, shown only in {currency}.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {formatCount(users.length)} users
        </span>
      </div>

      <div className="mt-6">
        <BarChart
          data={chartData}
          xAxisKey="label"
          bars={[{ label: "Expenses", dataKey: "expense", color: "#277666" }]}
          currency={currency}
          height={220}
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3 font-semibold">User</th>
              <th className="px-3 py-3 text-right font-semibold">Income</th>
              <th className="px-3 py-3 text-right font-semibold">Expenses</th>
              <th className="px-3 py-3 text-right font-semibold">
                Total amount
              </th>
              <th className="px-3 py-3 text-right font-semibold">
                Completed transactions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const name =
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                "Name unavailable"

              return (
                <tr key={user.userId}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{name}</div>
                    <div className="text-xs text-slate-500">
                      {user.email || "Email unavailable"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatUserCurrency(user.income, currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatUserCurrency(user.expense, currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatUserCurrency(user.totalAmount, currency)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCount(user.transactionCount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td className="px-3 py-3">
                Returned users subtotal · {currency}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatUserCurrency(totals.income, currency)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatUserCurrency(totals.expense, currency)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatUserCurrency(totals.totalAmount, currency)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {formatCount(totals.transactions)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

export function AdminReports() {
  const { user, token } = useAuth()

  const [startDateDraft, setStartDateDraft] = useState("")

  const [endDateDraft, setEndDateDraft] = useState("")

  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" })

  const [dateError, setDateError] = useState("")

  const [reports, setReports] = useState(null)

  const sessionKey = token && user?.id ? `${user.id}:${token}` : ""

  const requestKey = `${sessionKey}|${dateRange.startDate}|${dateRange.endDate}`

  const query = reportParams(dateRange.startDate, dateRange.endDate)

  const userQuery = reportParams(dateRange.startDate, dateRange.endDate, 500)

  useEffect(() => {
    const categoryController = new AbortController()

    const spendingController = new AbortController()

    let active = true

    const updateReport = (key, report) => {
      if (!active) return

      setReports((current) =>
        current?.requestKey === requestKey
          ? { ...current, [key]: report }
          : current,
      )
    }

    if (!sessionKey) {
      setReports({
        requestKey,

        category: {
          status: "error",

          data: null,

          error: "An administrator session is required to load reports.",
        },

        spending: {
          status: "error",

          data: null,

          error: "An administrator session is required to load reports.",
        },
      })

      return () => {
        active = false
      }
    }

    setReports({
      requestKey,

      category: { status: "loading", data: null, error: "" },

      spending: { status: "loading", data: null, error: "" },
    })

    apiRequest(`admin/reports/transactions-by-category${query}`, {
      token,

      signal: categoryController.signal,
    })

      .then(validateCategoryReport)

      .then((data) =>
        updateReport("category", { status: "success", data, error: "" }),
      )

      .catch((error) => {
        if (categoryController.signal.aborted) return

        updateReport("category", {
          status: "error",

          data: null,

          error: error.message || "Could not load the category report.",
        })
      })

    apiRequest(`admin/reports/user-spending${userQuery}`, {
      token,

      signal: spendingController.signal,
    })

      .then(validateUserSpendingReport)

      .then((data) =>
        updateReport("spending", { status: "success", data, error: "" }),
      )

      .catch((error) => {
        if (spendingController.signal.aborted) return

        updateReport("spending", {
          status: "error",

          data: null,

          error: error.message || "Could not load the user spending report.",
        })
      })

    return () => {
      active = false

      categoryController.abort()

      spendingController.abort()
    }
  }, [sessionKey, token, requestKey, query, userQuery])

  const hasCurrentReports = reports?.requestKey === requestKey

  const categoryReport = hasCurrentReports
    ? reports.category
    : { status: "loading", data: null, error: "" }

  const spendingReport = hasCurrentReports
    ? reports.spending
    : { status: "loading", data: null, error: "" }

  const categories = useMemo(() => {
    if (categoryReport.status !== "success") return []

    return [...categoryReport.data.data].sort(
      (left, right) => right.transactionCount - left.transactionCount,
    )
  }, [categoryReport])

  const usersByCurrency = useMemo(() => {
    if (spendingReport.status !== "success") return []

    const grouped = new Map()

    for (const userRow of spendingReport.data.data) {
      if (!grouped.has(userRow.currency)) grouped.set(userRow.currency, [])

      grouped.get(userRow.currency).push(userRow)
    }

    return [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }, [spendingReport])

  const summaryCards = [
    {
      label: "Completed transactions",

      value:
        categoryReport.status === "success"
          ? formatCount(categoryReport.data.summary.totalTransactions)
          : categoryReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      icon: "activity",

      tone: "bg-emerald-50 text-emerald-700",
    },

    {
      label: "Categories reported",

      value:
        categoryReport.status === "success"
          ? formatCount(categoryReport.data.data.length)
          : categoryReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      icon: "chart",

      tone: "bg-blue-50 text-blue-700",
    },

    {
      label: "Users returned",

      value:
        spendingReport.status === "success"
          ? formatCount(spendingReport.data.summary.totalUsers)
          : spendingReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      icon: "users",

      tone: "bg-amber-50 text-amber-700",

      subtitle: "Endpoint maximum: 500",
    },

    {
      label: "Transactions for returned users",

      value:
        spendingReport.status === "success"
          ? formatCount(spendingReport.data.summary.totalTransactions)
          : spendingReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      icon: "card",

      tone: "bg-indigo-50 text-indigo-700",
    },
  ]

  function applyDateRange(event) {
    event.preventDefault()

    if (startDateDraft && endDateDraft && startDateDraft > endDateDraft) {
      setDateError("Start date must be on or before end date.")

      return
    }

    setDateError("")

    setDateRange({ startDate: startDateDraft, endDate: endDateDraft })
  }

  return (
    <>
      <PageTitle
        title="Reports & analytics"
        sub="Live reports include completed transactions only. Monetary totals are shown per user currency."
        action={
          <Button disabled title="Report export is not available">
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        }
      />

      <form
        className="mb-5 flex flex-wrap items-end justify-between gap-3"
        onSubmit={applyDateRange}
      >
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Start date
            <input
              aria-label="Start date"
              type="date"
              value={startDateDraft}
              onChange={(event) => setStartDateDraft(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            End date
            <input
              aria-label="End date"
              type="date"
              value={endDateDraft}
              onChange={(event) => setEndDateDraft(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
            />
          </label>
        </div>
        <Button type="submit" variant="secondary">
          Apply date range
        </Button>
      </form>

      {dateError && <Alert className="mb-5" type="error" message={dateError} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <h2 className="font-bold text-slate-900">
            Completed transactions by category
          </h2>
          <p className="text-xs text-slate-500">
            Transaction counts; category report amounts are not
            currency-separated.
          </p>
          <ReportStatus
            report={categoryReport}
            emptyMessage="No completed transactions were found for this period."
          />
          {categoryReport.status === "success" && categories.length > 0 && (
            <div className="mt-5">
              <BarChart
                data={categories}
                xAxisKey="category"
                bars={[
                  {
                    label: "Transactions",

                    dataKey: "transactionCount",

                    color: "#277666",
                  },
                ]}
                valueFormatter={formatCount}
                height={250}
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-900">
            Share of completed transactions
          </h2>
          <p className="text-xs text-slate-500">By category count</p>
          <ReportStatus
            report={categoryReport}
            emptyMessage="No category data is available for this period."
          />
          {categoryReport.status === "success" && categories.length > 0 && (
            <div className="mt-5">
              <DonutChart
                data={categories.map((category, index) => ({
                  name: category.category,

                  value: category.transactionCount,

                  color: categoryColors[index % categoryColors.length],
                }))}
                innerText={formatCount(
                  categoryReport.data.summary.totalTransactions,
                )}
                innerSubtext="transactions"
                valueFormatter={formatCount}
                height={250}
              />
            </div>
          )}
        </Card>
      </div>

      <section className="mt-5 space-y-5">
        <div>
          <h2 className="font-bold text-slate-900">User spending</h2>
          <p className="text-xs text-slate-500">
            The API returns at most 500 users, ordered by expense. Subtotals
            cover returned users only.
          </p>
        </div>
        <ReportStatus
          report={spendingReport}
          emptyMessage="No completed user spending was found for this period."
        />
        {spendingReport.status === "success" && usersByCurrency.length > 0 && (
          <div className="space-y-5">
            {usersByCurrency.map(([currency, users]) => (
              <UserCurrencyReport
                key={currency}
                currency={currency}
                users={users}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export default AdminReports
