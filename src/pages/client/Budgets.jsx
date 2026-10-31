import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Icon from "@/components/ui/Icon"
import { budgets, getBudgetsByUser } from "@/data/mockBudgets"
import { formatCurrency } from "@/utils/formatters"

export function ClientBudgets() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [budgetList, setBudgetList] = useState(() => getBudgetsByUser(user?.id))

  const healthyCount = budgetList.filter(
    (b) => getBudgetStatus(b.spent, b.limit) === "healthy",
  ).length
  const warningCount = budgetList.filter(
    (b) => getBudgetStatus(b.spent, b.limit) === "warning",
  ).length
  const exceededCount = budgetList.filter(
    (b) => getBudgetStatus(b.spent, b.limit) === "exceeded",
  ).length

  const handleDelete = (id) => {
    const idx = budgets.findIndex((b) => b.id === id && b.userId === user?.id)
    if (idx !== -1) {
      budgets.splice(idx, 1)
      setBudgetList(getBudgetsByUser(user?.id))
    }
  }

  return (
    <>
      <PageTitle
        title="Monthly budgets"
        sub="Stay on track with your October 2026 spending plan."
        action={
          <Button onClick={() => navigate("/client/budgets/new")}>
            <Icon name="plus" className="size-4" />
            Create budget
          </Button>
        }
      />

      <div className="mb-6 flex gap-3">
        <Badge tone="green">{healthyCount} healthy</Badge>
        <Badge tone="amber">{warningCount} warning</Badge>
        <Badge tone="red">{exceededCount} exceeded</Badge>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {budgetList.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3">
            <p className="text-center text-sm text-slate-500">
              No budgets yet. Create a budget to get started.
            </p>
          </Card>
        ) : (
          budgetList.map((b) => {
            const progress = (b.spent / b.limit) * 100
            const isExceeded = progress >= 100
            const isWarning = progress >= 85 && progress < 100

            return (
              <Card key={b.id}>
                <div className="flex items-center justify-between">
                  <span
                    className="grid size-11 place-items-center rounded-xl"
                    style={{ backgroundColor: `${b.color}20`, color: b.color }}
                  >
                    <Icon name="tag" className="size-5" />
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${b.name} budget`}
                    onClick={() => handleDelete(b.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="trash" className="size-5" />
                  </button>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-lg font-bold">{b.name}</div>
                  <Badge
                    tone={isExceeded ? "red" : isWarning ? "amber" : "green"}
                    size="sm"
                  >
                    {Math.round(progress)}%
                  </Badge>
                </div>
                <div className="mt-5 h-2.5 rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      isExceeded
                        ? "bg-rose-500"
                        : isWarning
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
                      {formatCurrency(b.spent, user?.currency || "EUR")}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-400">Budget</span>
                    <b className="mt-1 block">
                      {formatCurrency(b.limit, user?.currency || "EUR")}
                    </b>
                  </div>
                  <div>
                    <span className="text-slate-400">Remaining</span>
                    <b className="mt-1 block">
                      {b.limit - b.spent >= 0
                        ? formatCurrency(
                            b.limit - b.spent,
                            user?.currency || "EUR",
                          )
                        : formatCurrency(
                            b.limit - b.spent,
                            user?.currency || "EUR",
                          )}
                    </b>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}

function getBudgetStatus(spent, limit) {
  const progress = (spent / limit) * 100
  if (progress >= 100) return "exceeded"
  if (progress >= 85) return "warning"
  return "healthy"
}

export default ClientBudgets
