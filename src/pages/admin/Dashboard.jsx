import { useEffect, useMemo, useState } from "react"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Icon from "@/components/ui/Icon"

import SummaryCard from "@/components/layout/SummaryCard"

import BarChart from "@/components/charts/BarChart"

import Card from "@/components/ui/Card"

import Alert from "@/components/ui/Alert"

import { useAuth } from "@/contexts/AuthContext"

import { apiRequest } from "@/lib/api"

import { SUPPORTED_CURRENCIES } from "@/utils/currencies"

import { formatUserCurrency } from "@/utils/formatters"

const supportedCurrencyCodes = new Set(
  SUPPORTED_CURRENCIES.map(({ code }) => code),
)

const statusNames = ["active", "pending", "suspended"]

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0
}

function validateListResponse(response) {
  if (
    !response ||
    !Array.isArray(response.data) ||
    !response.pagination ||
    !isNonNegativeInteger(response.pagination.total)
  ) {
    throw new Error("The admin list API returned an unexpected response.")
  }

  return response
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

function formatCount(value) {
  return new Intl.NumberFormat("en-GB").format(value)
}

function loadingReport() {
  return { status: "loading", data: null, error: "" }
}

function ReportStatus({ report, emptyMessage }) {
  if (report.status === "loading") {
    return (
      <p role="status" className="py-8 text-center text-sm text-slate-500">
        Loading dashboard data…
      </p>
    )
  }

  if (report.status === "error") {
    return (
      <Alert
        className="mt-5"
        type="error"
        title="Dashboard data unavailable"
        message={report.error}
      />
    )
  }

  if (report.isEmpty) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
    )
  }

  return null
}

function SpendingByCurrency({ currency, users }) {
  const displayedUsers = [...users]
    .sort((left, right) => right.expense - left.expense)
    .slice(0, 5)

  const chartData = displayedUsers.map((user) => ({
    label:
      user.email ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.userId,

    expense: user.expense,
  }))

  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {currency} expenses among returned users
        </h3>
        <span className="text-xs text-slate-500">
          {formatCount(users.length)} returned rows
        </span>
      </div>
      <BarChart
        data={chartData}
        xAxisKey="label"
        bars={[{ label: "Expenses", dataKey: "expense", color: "#277666" }]}
        currency={currency}
        height={190}
      />
      <ul className="mt-4 divide-y divide-slate-100 text-sm">
        {displayedUsers.map((user) => (
          <li key={user.userId} className="flex justify-between gap-3 py-2">
            <span className="truncate">
              {user.email ||
                `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.userId}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatUserCurrency(user.expense, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdminDashboard() {
  const { user, token } = useAuth()

  const [reports, setReports] = useState(null)

  const sessionKey = token && user?.id ? `${user.id}:${token}` : ""

  const requestKey = sessionKey

  useEffect(() => {
    const controller = new AbortController()

    let active = true

    const setSection = (section, report) => {
      if (!active) return

      setReports((current) =>
        current?.requestKey === requestKey
          ? { ...current, [section]: report }
          : current,
      )
    }

    if (!sessionKey) {
      setReports({
        requestKey,

        users: {
          status: "error",

          data: null,

          error: "An administrator session is required to load dashboard data.",
        },

        transactions: {
          status: "error",

          data: null,

          error: "An administrator session is required to load dashboard data.",
        },

        categories: {
          status: "error",

          data: null,

          error: "An administrator session is required to load dashboard data.",
        },

        spending: {
          status: "error",

          data: null,

          error: "An administrator session is required to load dashboard data.",
        },
      })

      return () => {
        active = false
      }
    }

    setReports({
      requestKey,

      users: loadingReport(),

      transactions: loadingReport(),

      categories: loadingReport(),

      spending: loadingReport(),
    })

    const options = { token, signal: controller.signal }

    const userEndpoints = [
      "admin/users?page=1&limit=1",

      ...statusNames.map(
        (status) => `admin/users?page=1&limit=1&status=${status}`,
      ),
    ]

    Promise.all(userEndpoints.map((endpoint) => apiRequest(endpoint, options)))

      .then((responses) => responses.map(validateListResponse))

      .then((responses) => {
        const [allUsers, ...statusUsers] = responses

        const statusCounts = Object.fromEntries(
          statusNames.map((status, index) => [
            status,

            statusUsers[index].pagination.total,
          ]),
        )

        const knownStatusTotal = Object.values(statusCounts).reduce(
          (total, count) => total + count,

          0,
        )

        setSection("users", {
          status: "success",

          data: {
            total: allUsers.pagination.total,

            statusCounts:
              knownStatusTotal === allUsers.pagination.total
                ? statusCounts
                : null,
          },

          error: "",
        })
      })

      .catch((error) => {
        if (controller.signal.aborted) return

        setSection("users", {
          status: "error",

          data: null,

          error: error.message || "Could not load user counts.",
        })
      })

    apiRequest("admin/transactions?page=1&limit=1", options)

      .then(validateListResponse)

      .then((response) =>
        setSection("transactions", {
          status: "success",

          data: response.pagination.total,

          error: "",
        }),
      )

      .catch((error) => {
        if (controller.signal.aborted) return

        setSection("transactions", {
          status: "error",

          data: null,

          error: error.message || "Could not load the transaction count.",
        })
      })

    apiRequest("admin/reports/transactions-by-category", options)

      .then(validateCategoryReport)

      .then((data) =>
        setSection("categories", { status: "success", data, error: "" }),
      )

      .catch((error) => {
        if (controller.signal.aborted) return

        setSection("categories", {
          status: "error",

          data: null,

          error: error.message || "Could not load the category report.",
        })
      })

    apiRequest("admin/reports/user-spending?limit=500", options)

      .then(validateUserSpendingReport)

      .then((data) =>
        setSection("spending", { status: "success", data, error: "" }),
      )

      .catch((error) => {
        if (controller.signal.aborted) return

        setSection("spending", {
          status: "error",

          data: null,

          error: error.message || "Could not load the user spending report.",
        })
      })

    return () => {
      active = false

      controller.abort()
    }
  }, [requestKey, sessionKey, token])

  const hasCurrentReports = reports?.requestKey === requestKey

  const usersReport = hasCurrentReports ? reports.users : loadingReport()

  const transactionsReport = hasCurrentReports
    ? reports.transactions
    : loadingReport()

  const categoriesReport = hasCurrentReports
    ? reports.categories
    : loadingReport()

  const spendingReport = hasCurrentReports ? reports.spending : loadingReport()

  const categories = useMemo(() => {
    if (categoriesReport.status !== "success") return []

    return [...categoriesReport.data.data].sort(
      (left, right) => right.transactionCount - left.transactionCount,
    )
  }, [categoriesReport])

  const usersByCurrency = useMemo(() => {
    if (spendingReport.status !== "success") return []

    const grouped = new Map()

    for (const spendingUser of spendingReport.data.data) {
      if (!grouped.has(spendingUser.currency)) {
        grouped.set(spendingUser.currency, [])
      }

      grouped.get(spendingUser.currency).push(spendingUser)
    }

    return [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )
  }, [spendingReport])

  const stats = [
    {
      label: "Total users",

      value:
        usersReport.status === "success"
          ? formatCount(usersReport.data.total)
          : usersReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      change: "",

      icon: "users",

      tone: "bg-blue-50 text-blue-700",

      subtitle: "All users from API pagination metadata",
    },

    {
      label: "Active users",

      value:
        usersReport.status === "success" && usersReport.data.statusCounts
          ? formatCount(usersReport.data.statusCounts.active)
          : usersReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      change: "",

      icon: "activity",

      tone: "bg-emerald-50 text-emerald-700",

      subtitle: "Exact status-filtered API count",
    },

    {
      label: "Total transactions",

      value:
        transactionsReport.status === "success"
          ? formatCount(transactionsReport.data)
          : transactionsReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      change: "",

      icon: "card",

      tone: "bg-violet-50 text-violet-700",

      subtitle: "All records from pagination metadata",
    },

    {
      label: "Completed transactions",

      value:
        categoriesReport.status === "success"
          ? formatCount(categoriesReport.data.summary.totalTransactions)
          : categoriesReport.status === "loading"
            ? "Loading…"
            : "Unavailable",

      change: "",

      icon: "chart",

      tone: "bg-amber-50 text-amber-700",

      subtitle: "Category report includes completed only",
    },
  ]

  const activityCounts =
    usersReport.status === "success" ? usersReport.data.statusCounts : null

  const totalUsers =
    usersReport.status === "success" ? usersReport.data.total : 0

  const activityRows = activityCounts
    ? [
        ["Active users", activityCounts.active],

        ["Pending users", activityCounts.pending],

        ["Suspended users", activityCounts.suspended],
      ]
    : []

  return (
    <>
      <PageTitle
        title="Administration dashboard"
        sub="Live counts use complete API pagination metadata. Completed category counts and returned user spending are reported separately."
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Overview export is unavailable"
          >
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <SummaryCard key={stat.label} {...stat} />
        ))}
      </div>
      {transactionsReport.status === "error" && (
        <Alert
          className="mt-4"
          type="error"
          title="Transaction count unavailable"
          message={transactionsReport.error}
        />
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="font-bold">Completed transactions by category</div>
          <div className="text-xs text-slate-500">
            Transaction counts only; the category API does not separate amounts
            by currency.
          </div>
          <ReportStatus
            report={{
              ...categoriesReport,

              isEmpty:
                categoriesReport.status === "success" &&
                categoriesReport.data.data.length === 0,
            }}
            emptyMessage="No completed category activity is available."
          />
          {categoriesReport.status === "success" && categories.length > 0 && (
            <div className="mt-5">
              <BarChart
                data={categories}
                xAxisKey="category"
                bars={[
                  {
                    label: "Completed transactions",

                    dataKey: "transactionCount",

                    color: "#277666",
                  },
                ]}
                valueFormatter={formatCount}
                height={220}
              />
            </div>
          )}
        </Card>

        <Card>
          <div className="font-bold">User account status</div>
          <div className="text-xs text-slate-500">
            Exact counts from status-filtered user API pagination metadata.
          </div>
          <ReportStatus
            report={{
              ...usersReport,

              status:
                usersReport.status === "success" &&
                !usersReport.data.statusCounts
                  ? "error"
                  : usersReport.status,

              error:
                usersReport.status === "success" &&
                !usersReport.data.statusCounts
                  ? "User status counts do not match the total user count."
                  : usersReport.error,

              isEmpty: usersReport.status === "success" && totalUsers === 0,
            }}
            emptyMessage="No users are registered."
          />
          {usersReport.status === "success" && activityCounts && (
            <div className="mt-6 space-y-5">
              {activityRows.map(([label, count]) => {
                const percentage = totalUsers ? (count / totalUsers) * 100 : 0

                return (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{label}</span>
                      <b>{formatCount(count)}</b>
                    </div>
                    <div className="h-2 rounded bg-slate-100">
                      <div
                        className="h-2 rounded bg-emerald-600"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="font-bold">User spending by currency</div>
        <p className="text-xs text-slate-500">
          API results are capped at 500 users. Charts show up to five returned
          users per currency and are not whole-database totals.
        </p>
        <ReportStatus
          report={{
            ...spendingReport,

            isEmpty:
              spendingReport.status === "success" &&
              spendingReport.data.data.length === 0,
          }}
          emptyMessage="No completed user spending is available."
        />
        {spendingReport.status === "success" && usersByCurrency.length > 0 && (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {usersByCurrency.map(([currency, currencyUsers]) => (
              <SpendingByCurrency
                key={currency}
                currency={currency}
                users={currencyUsers}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

export default AdminDashboard
