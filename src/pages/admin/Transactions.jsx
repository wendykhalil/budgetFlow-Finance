import { useState, useEffect, useRef } from "react"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Icon from "@/components/ui/Icon"
import SearchInput from "@/components/ui/SearchInput"
import { apiRequest } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { formatDate } from "@/utils/formatters"

export function AdminTransactions() {
  const { token } = useAuth()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    limit: 20,
  })

  const abortControllerRef = useRef(null)

  // Fetch transactions from API
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    const fetchTransactions = async () => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set("page", currentPage.toString())

        if (search) {
          params.set("category", search)
        }
        if (typeFilter !== "all") {
          params.set("type", typeFilter)
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }

        const response = await apiRequest(
          `/api/admin/transactions?${params.toString()}`,
          {
            token,
            signal: controller.signal,
          },
        )

        if (response?.data) {
          setTransactions(response.data)
          setPagination(response.pagination)
        }
      } catch (err) {
        // Ignore abort errors (user navigated away or newer request started)
        if (err.name === "AbortError") {
          return
        }
        setError(err.message || "Failed to load transactions")
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [token, currentPage, search, typeFilter, statusFilter])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, typeFilter, statusFilter])

  return (
    <>
      <PageTitle
        title="Transactions management"
        sub="Review platform-wide transaction activity."
        action={
          <Button
            disabled
            title="Admin transaction creation is unavailable in this demo"
          >
            Add record unavailable
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
          <div className="font-semibold">Error loading transactions</div>
          <div>{error}</div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput
            placeholder="Search by category..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
          <select
            aria-label="Filter by transaction status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Export is unavailable in this demo"
          >
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {[
                "User",
                "Description",
                "Category",
                "Type",
                "Amount",
                "Date",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-sm text-slate-500"
                >
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-4">
                    <span className="font-semibold">
                      {t.userId && typeof t.userId === "object"
                        ? `${t.userId.firstName} ${t.userId.lastName}`
                        : "Unknown user"}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold">{t.description}</td>
                  <td className="px-5 py-4">
                    <Badge tone="neutral" size="sm">
                      {t.category}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={t.type === "income" ? "green" : "neutral"}
                      size="sm"
                    >
                      {t.type}
                    </Badge>
                  </td>
                  <td
                    className={`px-5 py-4 font-bold ${
                      t.type === "income"
                        ? "text-emerald-600"
                        : "text-slate-800"
                    }`}
                  >
                    {t.type === "income" ? "+" : "−"}€{t.amount.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(t.date)}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={t.status === "completed" ? "green" : "amber"}
                      size="sm"
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      title="Transaction details are unavailable in admin view"
                    >
                      View unavailable
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <span>
          Showing{" "}
          {transactions.length > 0
            ? (currentPage - 1) * pagination.limit + 1
            : 0}
          –{Math.min(currentPage * pagination.limit, pagination.total)} of{" "}
          {pagination.total}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
            (page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? "page" : undefined}
                className={`grid size-8 place-items-center rounded-xl text-sm font-semibold ${
                  page === currentPage
                    ? "bg-[#155C4F] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  )
}

export default AdminTransactions
