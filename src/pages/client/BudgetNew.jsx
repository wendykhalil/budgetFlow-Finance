import { useMemo, useState } from "react"

import { useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"

import { useBudgets } from "@/contexts/BudgetContext"

import { useCategories } from "@/contexts/CategoryContext"

import PageTitle from "@/components/layout/PageTitle"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import {
  getCurrencyFractionDigits,
  getCurrencySymbol,
} from "@/utils/currencies"

function getCurrentMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function BudgetNew() {
  const navigate = useNavigate()

  const { user } = useAuth()

  const { budgets, createBudget } = useBudgets()

  const {
    categories,

    loading: categoriesLoading,

    error: categoriesError,
  } = useCategories()

  const currency = user?.currency || "EUR"

  const fractionDigits = getCurrencyFractionDigits(currency)

  const amountStep = String(1 / 10 ** fractionDigits)

  const [name, setName] = useState("")

  const [limit, setLimit] = useState("")

  const [categoryId, setCategoryId] = useState("")

  const [month, setMonth] = useState(getCurrentMonth)

  const [error, setError] = useState("")

  const [saving, setSaving] = useState(false)

  const categoryOptions = useMemo(
    () =>
      categories

        .filter(
          (category) =>
            category.type === "expense" && category.isArchived !== true,
        )

        .map((category) => ({
          value: category.id,

          label: category.name,
        })),

    [categories],
  )

  function validateLimit(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Enter a budget limit greater than zero."
    }

    const scaledAmount = amount * 10 ** fractionDigits

    if (Math.abs(scaledAmount - Math.round(scaledAmount)) > 1e-8) {
      return `The limit supports up to ${fractionDigits} decimal places in ${currency}.`
    }

    return ""
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (saving) return

    const parsedLimit = Number(limit)

    if (!name.trim() || name.trim().length > 80) {
      setError("Enter a budget name of 1 to 80 characters.")

      return
    }

    const limitError = validateLimit(parsedLimit)

    if (limitError) {
      setError(limitError)

      return
    }

    if (!categoryOptions.some((category) => category.value === categoryId)) {
      setError("Choose an active expense category.")

      return
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      setError("Choose a valid budget month.")

      return
    }

    const startDate = `${month}-01`

    const duplicate = budgets.some(
      (budget) =>
        budget.categoryId?.id === categoryId && budget.startDate === startDate,
    )

    if (duplicate) {
      setError("A budget already exists for this category and month.")

      return
    }

    setError("")

    setSaving(true)

    try {
      const budget = await createBudget({
        name: name.trim(),

        limit: parsedLimit,

        categoryId,

        period: "monthly",

        startDate,
      })

      navigate(`/client/budgets/${budget.id}`, {
        state: { successMessage: "Budget created." },
      })
    } catch (requestError) {
      setError(requestError.message || "Could not create the budget.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Create budget"
        sub="Set a spending limit and track your progress."
        action={
          <Button
            variant="secondary"
            onClick={() => navigate("/client/budgets")}
            disabled={saving}
          >
            Cancel
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="budget-name"
                className="text-sm font-semibold text-slate-700"
              >
                Name
              </label>
              <input
                id="budget-name"
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                placeholder="Food budget"
                required
              />
            </div>
            <div>
              <label
                htmlFor="budget-category"
                className="text-sm font-semibold text-slate-700"
              >
                Expense category
              </label>
              <select
                id="budget-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                disabled={categoriesLoading || categoryOptions.length === 0}
                required
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories..."
                    : categoryOptions.length
                      ? "Select category"
                      : "No active expense categories"}
                </option>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {categoriesError && (
                <p role="alert" className="mt-2 text-sm text-rose-600">
                  {categoriesError}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="budget-month"
                className="text-sm font-semibold text-slate-700"
              >
                Budget month
              </label>
              <input
                id="budget-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label
                htmlFor="budget-period"
                className="text-sm font-semibold text-slate-700"
              >
                Period
              </label>
              <input
                id="budget-period"
                value="Monthly"
                readOnly
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="budget-limit"
                className="text-sm font-semibold text-slate-700"
              >
                Budget limit ({currency})
              </label>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  id="budget-limit"
                  type="number"
                  min={amountStep}
                  step={amountStep}
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-10 text-sm text-slate-900 outline-none focus:border-emerald-600"
                  placeholder={`500.${"0".repeat(fractionDigits)}`}
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-6">
            <Button
              variant="secondary"
              onClick={() => navigate("/client/budgets")}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving || categoriesLoading || categoryOptions.length === 0
              }
            >
              {saving ? "Creating..." : "Create budget"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}

export default BudgetNew
