import { useState } from "react"

import { useLocation, useNavigate } from "react-router-dom"

import { useEffect } from "react"

import { useAuth } from "@/contexts/AuthContext"

import { useBudgets } from "@/contexts/BudgetContext"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import LoadingSkeleton from "@/components/ui/LoadingSkeleton"

import { ConfirmModal } from "@/components/ui/Modal"

import { useToast } from "@/components/ui/Toast"

import { formatCurrency, formatPercent } from "@/utils/formatters"

const statusLabels = {
  healthy: "healthy",

  warning: "warning",

  exceeded: "exceeded",
}

const statusTones = {
  healthy: "green",

  warning: "amber",

  exceeded: "red",
}

export function ClientBudgets() {
  const navigate = useNavigate()

  const location = useLocation()

  const { user } = useAuth()

  const {
    budgets,

    loading,

    error,

    refreshBudgets,

    deleteBudget,
  } = useBudgets()

  const { showToast, ToastComponent } = useToast()

  const [budgetToDelete, setBudgetToDelete] = useState(null)

  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!location.state?.successMessage) return

    showToast(location.state.successMessage)

    navigate(location.pathname, { replace: true, state: null })
  }, [location.key, location.pathname, location.state, navigate, showToast])

  const healthyCount = budgets.filter(
    (budget) => budget.spending?.status === "healthy",
  ).length

  const warningCount = budgets.filter(
    (budget) => budget.spending?.status === "warning",
  ).length

  const exceededCount = budgets.filter(
    (budget) => budget.spending?.status === "exceeded",
  ).length

  async function handleDelete() {
    if (!budgetToDelete) return

    setDeleting(true)

    try {
      await deleteBudget(budgetToDelete.id)

      showToast("Budget deleted.")

      setBudgetToDelete(null)
    } catch (requestError) {
      showToast(requestError.message || "Could not delete the budget.", "error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Monthly budgets"
        sub="Stay on track with your monthly spending plan."
        action={
          <Button onClick={() => navigate("/client/budgets/new")}>
            <Icon name="plus" className="size-4" />
            Create budget
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Badge tone="green">{healthyCount} healthy</Badge>
        <Badge tone="amber">{warningCount} warning</Badge>
        <Badge tone="red">{exceededCount} exceeded</Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refreshBudgets()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-5">
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => refreshBudgets()}
            disabled={loading}
          >
            Try again
          </Button>
        </Card>
      )}

      {loading && budgets.length === 0 ? (
        <div
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Loading budgets"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <Card key={index}>
              <LoadingSkeleton lines={4} />
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card className="md:col-span-2 xl:col-span-3">
          <p className="text-center text-sm text-slate-500">
            No budgets yet. Create a budget to get started.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => {
            const spending = budget.spending

            const progress = spending?.percentUsed || 0

            const status = statusLabels[spending?.status] || "healthy"

            const color = budget.categoryId?.color || "#277666"

            const categoryName = budget.categoryId?.name || "Archived category"

            return (
              <Card key={budget.id}>
                <div className="flex items-center justify-between">
                  <span
                    className="grid size-11 place-items-center rounded-xl"
                    style={{ backgroundColor: `${color}20`, color }}
                  >
                    <Icon name="tag" className="size-5" />
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${budget.name} budget`}
                    onClick={() => setBudgetToDelete(budget)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="trash" className="size-5" />
                  </button>
                </div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{budget.name}</div>
                    <div className="text-sm text-slate-500">{categoryName}</div>
                  </div>
                  <Badge tone={statusTones[status]} size="sm">
                    {`${formatPercent(progress)} · ${status}`}
                  </Badge>
                </div>
                <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      status === "exceeded"
                        ? "bg-rose-500"
                        : status === "warning"
                          ? "bg-amber-500"
                          : "bg-[#277666]"
                    }`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Spent</span>
                    <b className="mt-1 block">
                      {formatCurrency(
                        spending?.spent || 0,

                        user?.currency || "EUR",
                      )}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-400">Budget</span>
                    <b className="mt-1 block">
                      {formatCurrency(budget.limit, user?.currency || "EUR")}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-400">Remaining</span>
                    <b className="mt-1 block">
                      {formatCurrency(
                        spending?.remaining ?? budget.limit,

                        user?.currency || "EUR",
                      )}
                    </b>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Monthly · {budget.startDate}
                </p>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={() => navigate(`/client/budgets/${budget.id}`)}
                >
                  View details
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(budgetToDelete)}
        onClose={() => {
          if (!deleting) setBudgetToDelete(null)
        }}
        onConfirm={handleDelete}
        title="Delete budget"
        message={`Delete "${budgetToDelete?.name}"? This cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        confirmDisabled={deleting}
        danger
      />
      {ToastComponent}
    </>
  )
}

export default ClientBudgets
