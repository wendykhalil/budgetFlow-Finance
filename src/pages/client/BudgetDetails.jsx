import { useCallback, useEffect, useMemo, useState } from "react"

import { useLocation, useNavigate, useParams } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"

import { useBudgets } from "@/contexts/BudgetContext"

import { useCategories } from "@/contexts/CategoryContext"

import { apiRequest } from "@/lib/api"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import Icon from "@/components/ui/Icon"

import Badge from "@/components/ui/Badge"

import LoadingSkeleton from "@/components/ui/LoadingSkeleton"

import { ConfirmModal } from "@/components/ui/Modal"

import { useToast } from "@/components/ui/Toast"

import { formatCurrency, formatPercent } from "@/utils/formatters"

import { getCurrencyFractionDigits } from "@/utils/currencies"

const statusTones = {
  healthy: "green",

  warning: "amber",

  exceeded: "red",
}

function getMonthValue(startDate) {
  return typeof startDate === "string" ? startDate.slice(0, 7) : ""
}

export function BudgetDetails() {
  const { id } = useParams()

  const navigate = useNavigate()

  const location = useLocation()

  const { user } = useAuth()

  const { budgets, updateBudget, deleteBudget, upsertBudget } = useBudgets()

  const { categories } = useCategories()

  const { showToast, ToastComponent } = useToast()

  const [budget, setBudget] = useState(null)

  const [spending, setSpending] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [name, setName] = useState("")

  const [limit, setLimit] = useState("")

  const [categoryId, setCategoryId] = useState("")

  const [month, setMonth] = useState("")

  const [formError, setFormError] = useState("")

  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const currency = user?.currency || "EUR"

  const fractionDigits = getCurrencyFractionDigits(currency)

  const categoryOptions = useMemo(() => {
    const active = categories.filter(
      (category) => category.type === "expense" && category.isArchived !== true,
    )

    if (
      budget?.categoryId?.id &&
      !active.some((category) => category.id === budget.categoryId.id)
    ) {
      return [
        {
          ...budget.categoryId,

          isArchived: true,
        },

        ...active,
      ]
    }

    return active
  }, [categories, budget])

  const loadBudget = useCallback(
    async (signal) => {
      if (!id) {
        setError("Budget not found.")

        setLoading(false)

        return
      }

      setLoading(true)

      setError("")

      try {
        const token = localStorage.getItem("budgetflow_token")

        const [budgetResponse, spendingResponse] = await Promise.all([
          apiRequest(`budgets/${encodeURIComponent(id)}`, { token, signal }),

          apiRequest(`budgets/${encodeURIComponent(id)}/spent`, {
            token,

            signal,
          }),
        ])

        if (budgetResponse?.budget?.id !== id) {
          throw new Error("The budgets service returned an invalid response.")
        }

        if (
          !spendingResponse ||
          typeof spendingResponse.spent !== "number" ||
          typeof spendingResponse.remaining !== "number" ||
          typeof spendingResponse.percentUsed !== "number" ||
          typeof spendingResponse.status !== "string"
        ) {
          throw new Error(
            "The budget spending service returned an invalid response.",
          )
        }

        setBudget(budgetResponse.budget)

        setSpending(spendingResponse)

        setName(budgetResponse.budget.name)

        setLimit(String(budgetResponse.budget.limit))

        setCategoryId(budgetResponse.budget.categoryId?.id || "")

        setMonth(getMonthValue(budgetResponse.budget.startDate))

        upsertBudget({ ...budgetResponse.budget, spending: spendingResponse })
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Could not load the budget.")
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },

    [id, upsertBudget],
  )

  useEffect(() => {
    const controller = new AbortController()

    loadBudget(controller.signal)

    return () => controller.abort()
  }, [loadBudget])

  useEffect(() => {
    if (!location.state?.successMessage) return

    showToast(location.state.successMessage)

    navigate(location.pathname, { replace: true, state: null })
  }, [location.key, location.pathname, location.state, navigate, showToast])

  useEffect(() => {
    const sharedBudget = budgets.find((item) => item.id === id)

    if (!sharedBudget) return

    setBudget((current) =>
      current && current.id === sharedBudget.id ? sharedBudget : current,
    )

    if (sharedBudget.spending) setSpending(sharedBudget.spending)
  }, [budgets, id])

  async function handleUpdate(event) {
    event.preventDefault()

    if (!budget || saving) return

    const parsedLimit = Number(limit)

    if (!name.trim() || name.trim().length > 80) {
      setFormError("Enter a budget name of 1 to 80 characters.")

      return
    }

    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setFormError("Enter a budget limit greater than zero.")

      return
    }

    const scaledLimit = parsedLimit * 10 ** fractionDigits

    if (Math.abs(scaledLimit - Math.round(scaledLimit)) > 1e-8) {
      setFormError(
        `The limit supports up to ${fractionDigits} decimal places in ${currency}.`,
      )

      return
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      setFormError("Choose a valid budget month.")

      return
    }

    const categoryIsUnchanged = categoryId === budget.categoryId?.id
    if (
      !categoryIsUnchanged &&
      !categoryOptions.some(
        (category) =>
          category.id === categoryId && category.isArchived !== true,
      )
    ) {
      setFormError("Choose an active expense category.")

      return
    }

    const startDate = `${month}-01`

    const duplicate = budgets.some(
      (item) =>
        item.id !== budget.id &&
        item.categoryId?.id === categoryId &&
        item.startDate === startDate,
    )

    if (duplicate) {
      setFormError("A budget already exists for this category and month.")

      return
    }

    setSaving(true)

    setFormError("")

    try {
      const updates = {
        name: name.trim(),

        limit: parsedLimit,

        startDate,
      }

      if (categoryId !== budget.categoryId?.id) {
        updates.categoryId = categoryId
      }

      const updatedBudget = await updateBudget(budget.id, updates)

      const spendingResponse = await apiRequest(
        `budgets/${encodeURIComponent(budget.id)}/spent`,

        { token: localStorage.getItem("budgetflow_token") },
      )

      if (
        !spendingResponse ||
        typeof spendingResponse.spent !== "number" ||
        typeof spendingResponse.remaining !== "number" ||
        typeof spendingResponse.percentUsed !== "number" ||
        typeof spendingResponse.status !== "string"
      ) {
        throw new Error(
          "The budget spending service returned an invalid response.",
        )
      }

      setBudget(updatedBudget)

      setSpending(spendingResponse)

      upsertBudget({ ...updatedBudget, spending: spendingResponse })

      showToast("Budget updated.")
    } catch (requestError) {
      setFormError(requestError.message || "Could not update the budget.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!budget || deleting) return

    setDeleting(true)

    try {
      await deleteBudget(budget.id)

      navigate("/client/budgets", {
        state: { successMessage: "Budget deleted." },
      })
    } catch (requestError) {
      setError(requestError.message || "Could not delete the budget.")

      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <Card aria-label="Loading budget">
        <LoadingSkeleton lines={5} />
      </Card>
    )
  }

  if (error || !budget || !spending) {
    return (
      <>
        <Card>
          <p role="alert" className="font-semibold text-rose-700">
            {error || "Budget not found."}
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/client/budgets")}
            >
              Back to budgets
            </Button>
            <Button onClick={() => loadBudget()}>Try again</Button>
          </div>
        </Card>
        {ToastComponent}
      </>
    )
  }

  const progress = spending.percentUsed

  return (
    <>
      <PageTitle
        title={budget.name}
        sub="Budget details and progress."
        action={
          <Button
            variant="secondary"
            onClick={() => navigate("/client/budgets")}
          >
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      <Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{budget.name}</h3>
              <p className="text-sm text-slate-500">
                {budget.categoryId?.name || "Archived category"} · Monthly ·{" "}
                {budget.startDate}
              </p>
            </div>
            <Badge tone={statusTones[spending.status] || "green"}>
              {spending.status}
            </Badge>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Spent: {formatCurrency(spending.spent, currency)}</span>
              <span>Limit: {formatCurrency(spending.limit, currency)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  spending.status === "exceeded"
                    ? "bg-rose-500"
                    : spending.status === "warning"
                      ? "bg-amber-500"
                      : "bg-emerald-600"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-slate-500">
              {formatPercent(progress)} used
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(spending.spent, currency)}
              </div>
              <div className="text-xs text-slate-400">Spent</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(spending.limit, currency)}
              </div>
              <div className="text-xs text-slate-400">Budget limit</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {formatCurrency(spending.remaining, currency)}
              </div>
              <div className="text-xs text-slate-400">Remaining</div>
            </div>
          </div>
          <form
            onSubmit={handleUpdate}
            className="space-y-4 border-t border-slate-100 pt-6"
          >
            <h4 className="font-semibold">Update budget</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Name
                <input
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
                  required
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Expense category
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal"
                  required
                >
                  {categoryOptions.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      disabled={category.isArchived}
                    >
                      {category.name}
                      {category.isArchived ? " (archived)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Budget month
                <input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
                  required
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Budget limit ({currency})
                <input
                  type="number"
                  min={1 / 10 ** fractionDigits}
                  step={1 / 10 ** fractionDigits}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-normal"
                  required
                />
              </label>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-rose-600">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting || saving}
              >
                Delete budget
              </Button>
              <Button type="submit" disabled={saving || deleting}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => {
          if (!deleting) setConfirmDelete(false)
        }}
        onConfirm={handleDelete}
        title="Delete budget"
        message={`Delete "${budget.name}"? This cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete"}
        confirmDisabled={deleting}
        danger
      />
      {ToastComponent}
    </>
  )
}

export default BudgetDetails
