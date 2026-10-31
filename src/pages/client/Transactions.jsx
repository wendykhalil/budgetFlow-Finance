import { useEffect, useMemo, useState } from "react"

import { useLocation, useNavigate } from "react-router-dom"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import SearchInput from "@/components/ui/SearchInput"

import { ConfirmModal } from "@/components/ui/Modal"

import { useToast } from "@/components/ui/Toast"

import { apiRequest } from "@/lib/api"

import { useCategories } from "@/contexts/CategoryContext"

import { useAuth } from "@/contexts/AuthContext"

import { useTransactions } from "@/contexts/TransactionContext"

import {
  filterTransactions,
  formatCurrency,
  formatDateShort,
  paginate,
} from "@/utils/formatters"

function getTransactionCategoryId(transaction) {
  const categoryId = transaction.categoryId

  if (!categoryId) return ""

  const id =
    typeof categoryId === "object"
      ? categoryId.id || categoryId._id
      : categoryId

  return id ? String(id) : ""
}

function getCategoryFilterValue(category) {
  return category.kind === "linked"
    ? `linked:${category.id}`
    : `legacy:${JSON.stringify([category.type, category.name])}`
}

function buildCategoryOptions(activeCategories, transactions, typeFilter) {
  const optionsByValue = new Map()

  const matchesType = (type) => typeFilter === "all" || type === typeFilter

  activeCategories.forEach((category) => {
    if (
      !category.id ||
      category.isArchived === true ||
      !matchesType(category.type)
    )
      return

    const option = {
      kind: "linked",

      id: String(category.id),

      name: category.name,

      type: category.type,

      active: true,
    }

    optionsByValue.set(getCategoryFilterValue(option), option)
  })

  transactions.forEach((transaction) => {
    if (!matchesType(transaction.type)) return

    const id = getTransactionCategoryId(transaction)

    const option = id
      ? {
          kind: "linked",

          id,

          name: transaction.category,

          type: transaction.type,

          active: false,
        }
      : {
          kind: "legacy",

          name: transaction.category,

          type: transaction.type,

          active: false,
        }

    const value = getCategoryFilterValue(option)

    if (!optionsByValue.has(value)) optionsByValue.set(value, option)
  })

  const options = [...optionsByValue.entries()]

  const nameCounts = new Map()

  const nameTypeCounts = new Map()

  options.forEach(([, option]) => {
    const nameKey = option.name

    const nameTypeKey = JSON.stringify([option.name, option.type])

    nameCounts.set(nameKey, (nameCounts.get(nameKey) || 0) + 1)

    nameTypeCounts.set(nameTypeKey, (nameTypeCounts.get(nameTypeKey) || 0) + 1)
  })

  return options
    .map(([value, option]) => {
      let label = option.name

      if (nameCounts.get(option.name) > 1) {
        label += ` — ${option.type === "income" ? "Income" : "Expense"}`
      }

      if (nameTypeCounts.get(JSON.stringify([option.name, option.type])) > 1) {
        label +=
          option.kind === "legacy"
            ? " (legacy)"
            : option.active
              ? " (active)"
              : " (historical)"
      }

      return { ...option, value, label }
    })
    .sort(
      (left, right) =>
        left.label.localeCompare(right.label) ||
        left.value.localeCompare(right.value),
    )
}

export function ClientTransactions() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const location = useLocation()

  const { showToast, ToastComponent } = useToast()

  const {
    transactions,

    loading,

    error,

    refreshTransactions,

    removeTransaction,
  } = useTransactions()

  const { categories: activeCategories } = useCategories()

  const [search, setSearch] = useState("")

  const [typeFilter, setTypeFilter] = useState("all")

  const [statusFilter, setStatusFilter] = useState("all")

  const [categoryFilter, setCategoryFilter] = useState("all")

  const [dateFilter, setDateFilter] = useState("this-month")

  const [currentPage, setCurrentPage] = useState(1)

  const [transactionToDelete, setTransactionToDelete] = useState(null)

  const [deletingId, setDeletingId] = useState("")

  const itemsPerPage = 10

  const categoryOptions = useMemo(
    () => buildCategoryOptions(activeCategories, transactions, typeFilter),

    [activeCategories, transactions, typeFilter],
  )

  const selectedCategory = categoryOptions.find(
    (option) => option.value === categoryFilter,
  )

  useEffect(() => {
    if (location.state?.successMessage) {
      showToast(location.state.successMessage)

      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.key, location.pathname, location.state, navigate, showToast])

  const filtered = useMemo(
    () =>
      filterTransactions(transactions, {
        search,

        type: typeFilter,

        status: statusFilter,

        category: selectedCategory || "all",

        date: dateFilter,
      }),
    [
      transactions,
      search,
      typeFilter,
      statusFilter,
      selectedCategory,
      dateFilter,
    ],
  )

  const paginated = useMemo(
    () => paginate(filtered, currentPage, itemsPerPage),

    [filtered, currentPage],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [search, typeFilter, statusFilter, categoryFilter, dateFilter])

  useEffect(() => {
    if (categoryFilter !== "all" && !selectedCategory) {
      setCategoryFilter("all")
    }
  }, [categoryFilter, selectedCategory])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filtered.length / itemsPerPage))

    if (currentPage > lastPage) setCurrentPage(lastPage)
  }, [currentPage, filtered.length])

  async function handleDelete() {
    if (!transactionToDelete) return

    setDeletingId(transactionToDelete.id)

    try {
      await apiRequest(`transactions/${transactionToDelete.id}`, {
        method: "DELETE",

        token: localStorage.getItem("budgetflow_token"),
      })

      removeTransaction(transactionToDelete.id)

      showToast("Transaction deleted.")

      setTransactionToDelete(null)
    } catch (requestError) {
      showToast(
        requestError.message || "Could not delete the transaction.",
        "error",
      )
    } finally {
      setDeletingId("")
    }
  }

  return (
    <>
      <PageTitle
        title="Transactions"
        sub="Track, search, and manage all your account activity."
        action={
          <Button onClick={() => navigate("/client/transactions/new")}>
            <Icon name="plus" className="size-4" /> Add transaction
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-48 flex-1">
          <SearchInput
            placeholder="Search transactions..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(event) => {
              const nextType = event.target.value

              setTypeFilter(nextType)

              if (
                categoryFilter !== "all" &&
                !categoryOptions.some(
                  (option) =>
                    option.value === categoryFilter &&
                    (nextType === "all" || option.type === nextType),
                )
              ) {
                setCategoryFilter("all")
              }
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-year">This Year</option>
          </select>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Export is unavailable"
          >
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
            <Button
              className="mt-4"
              onClick={refreshTransactions}
              disabled={loading}
            >
              {loading ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  {[
                    "Date",
                    "Description",
                    "Category",
                    "Type",
                    "Amount",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-5 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-sm text-slate-500"
                    >
                      Loading transactions...
                    </td>
                  </tr>
                ) : paginated.items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-sm text-slate-500"
                    >
                      {transactions.length === 0
                        ? "You have no transactions yet. Add one to get started."
                        : "No transactions found. Try adjusting or clearing your filters."}
                    </td>
                  </tr>
                ) : (
                  paginated.items.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDateShort(transaction.date)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold">
                          {transaction.description}
                        </div>
                        {transaction.note && (
                          <div className="text-xs text-slate-400">
                            {transaction.note}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone="neutral" size="sm">
                          {transaction.category}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {transaction.type}
                      </td>
                      <td
                        className={`px-5 py-4 font-bold ${
                          transaction.type === "income"
                            ? "text-emerald-600"
                            : "text-slate-800"
                        }`}
                      >
                        {formatCurrency(
                          transaction.type === "expense"
                            ? -transaction.amount
                            : transaction.amount,
                          user?.currency || "EUR",
                        )}
                      </td>
                      <td className="px-5 py-4">
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`View transaction ${transaction.description}`}
                            onClick={() =>
                              navigate(`/client/transactions/${transaction.id}`)
                            }
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <Icon name="eye" className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete transaction ${transaction.description}`}
                            onClick={() => setTransactionToDelete(transaction)}
                            disabled={Boolean(deletingId)}
                            className="text-rose-600 hover:text-rose-700 disabled:opacity-50"
                          >
                            <Icon name="trash" className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <span>
          Showing {paginated.totalItems === 0 ? 0 : paginated.startIndex}–
          {paginated.endIndex} of {paginated.totalItems}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={
              paginated.totalPages === 0 ||
              currentPage >= paginated.totalPages ||
              loading
            }
            onClick={() =>
              setCurrentPage((page) => Math.min(page + 1, paginated.totalPages))
            }
          >
            Next
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(transactionToDelete)}
        onClose={() => {
          if (!deletingId) setTransactionToDelete(null)
        }}
        onConfirm={handleDelete}
        title="Delete transaction"
        message={`Delete "${transactionToDelete?.description || ""}"? This cannot be undone.`}
        confirmText={deletingId ? "Deleting..." : "Delete"}
        danger
        confirmDisabled={Boolean(deletingId)}
      />
      {ToastComponent}
    </>
  )
}

export default ClientTransactions
