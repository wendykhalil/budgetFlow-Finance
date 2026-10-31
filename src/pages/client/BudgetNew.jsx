import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import { budgets } from "@/data/mockBudgets"
import { categories } from "@/data/mockCategories"
import {
  getCurrencyFractionDigits,
  getCurrencySymbol,
} from "@/utils/currencies"

export function BudgetNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const currency = user?.currency || "EUR"
  const amountStep = String(1 / 10 ** getCurrencyFractionDigits(currency))
  const [name, setName] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    const parsedLimit = Number(limit)
    if (
      !name.trim() ||
      !Number.isFinite(parsedLimit) ||
      parsedLimit <= 0 ||
      !category
    ) {
      setError("Enter a budget name, a positive limit, and a category.")
      return
    }
    setError("")

    const newBudget = {
      id: `bud_${Date.now()}`,
      name: name.trim(),
      category,
      limit: parsedLimit,
      spent: 0,
      color: "#277666",
      icon: "tag",
      userId: user.id,
      period: "monthly",
    }

    budgets.unshift(newBudget)
    navigate("/client/budgets")
  }

  const categoryOptions = categories
    .filter((c) => c.type === "expense" && c.userId === user?.id)
    .map((c) => ({ value: c.name, label: c.name }))

  return (
    <>
      <PageTitle
        title="Create budget"
        sub="Set a spending limit and track your progress."
        action={
          <Button
            variant="secondary"
            onClick={() => navigate("/client/budgets")}
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
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
                placeholder="Food budget"
              />
            </div>
            <div>
              <label
                htmlFor="budget-category"
                className="text-sm font-semibold text-slate-700"
              >
                Category
              </label>
              <select
                id="budget-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600"
              >
                <option value="">Select category</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="budget-limit"
                className="text-sm font-semibold text-slate-700"
              >
                Budget limit
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
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-10 text-sm text-slate-900 outline-none focus:border-emerald-600"
                  placeholder={`500.${"0".repeat(getCurrencyFractionDigits(currency))}`}
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
            >
              Cancel
            </Button>
            <Button type="submit">Create budget</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

export default BudgetNew
