import { useState } from "react"

import { useNavigate, useParams } from "react-router-dom"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import { ConfirmModal } from "@/components/ui/Modal"

import { useToast } from "@/components/ui/Toast"

import { apiRequest } from "@/lib/api"

import { useTransactions } from "@/contexts/TransactionContext"

import { useAuth } from "@/contexts/AuthContext"

import { formatSignedCurrency } from "@/utils/formatters"
import { formatCalendarDate } from "@/utils/calendarDates"

export function TransactionDetails() {
  const navigate = useNavigate()

  const { id } = useParams()

  const { showToast, ToastComponent } = useToast()

  const { user } = useAuth()

  const {
    transactions,

    loading,

    error,

    refreshTransactions,

    removeTransaction,
  } = useTransactions()

  const transaction = transactions.find((item) => item.id === id) || null

  const [confirmDelete, setConfirmDelete] = useState(false)

  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!transaction) return

    setDeleting(true)

    try {
      await apiRequest(`transactions/${transaction.id}`, {
        method: "DELETE",

        token: localStorage.getItem("budgetflow_token"),
      })

      removeTransaction(transaction.id)

      navigate("/client/transactions", {
        state: { successMessage: "Transaction deleted." },
      })
    } catch (requestError) {
      showToast(
        requestError.message || "Could not delete the transaction.",
        "error",
      )
    } finally {
      setDeleting(false)

      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <p role="status" className="py-8 text-center text-sm text-slate-500">
          Loading transaction...
        </p>
      </Card>
    )
  }

  if (error && !transaction) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/client/transactions")}
            >
              Back to transactions
            </Button>
            <Button onClick={refreshTransactions} disabled={loading}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!transaction) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p
            role={loading ? "status" : "alert"}
            className="text-sm text-slate-500"
          >
            {loading ? "Loading transaction..." : "Transaction not found."}
          </p>
          {!loading && (
            <Button className="mt-4" onClick={refreshTransactions}>
              Retry
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <>
      <PageTitle
        title="Transaction details"
        sub="View and manage transaction."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate("/client/transactions")}
            >
              <Icon name="arrow-left" className="size-4" /> Back
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/client/transactions/${transaction.id}/edit`)
              }
            >
              <Icon name="edit" className="size-4" /> Edit
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="text-sm text-slate-500">Description</div>
            <div className="mt-1 font-semibold">{transaction.description}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Amount</div>
            <div
              className={`mt-1 text-2xl font-bold ${
                transaction.type === "income"
                  ? "text-emerald-600"
                  : "text-slate-800"
              }`}
            >
              {formatSignedCurrency(
                transaction.type === "income"
                  ? transaction.amount
                  : -transaction.amount,

                user?.currency || "EUR",
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Category</div>
            <div className="mt-1 font-semibold">{transaction.category}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Type</div>
            <div className="mt-1">
              <Badge tone={transaction.type === "income" ? "green" : "neutral"}>
                {transaction.type}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Date</div>
            <div className="mt-1 font-semibold">
              {formatCalendarDate(transaction.date)}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Payment method</div>
            <div className="mt-1 font-semibold">
              {transaction.paymentMethod || "Not specified"}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Status</div>
            <div className="mt-1">
              <Badge
                tone={
                  (transaction.status || "completed") === "completed"
                    ? "green"
                    : "amber"
                }
              >
                {(transaction.status || "completed") === "completed"
                  ? "Completed"
                  : "Pending"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Note</div>
            <div className="mt-1 font-semibold">
              {transaction.note || "No note"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
          <Button
            variant="secondary"
            onClick={() => navigate("/client/transactions")}
          >
            Back to transactions
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete transaction"}
          </Button>
        </div>
      </Card>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false)
        }}
        onConfirm={handleDelete}
        title="Delete transaction"
        message={`Delete "${transaction.description}"? This cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        danger
        confirmDisabled={deleting}
      />
      {ToastComponent}
    </>
  )
}

export default TransactionDetails
