import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import Badge from '@/components/ui/Badge'
import { budgets, getBudgetStatus, getBudgetProgress } from '@/data/mockBudgets'
import { formatCurrency } from '@/utils/formatters'

export function BudgetDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const budget = budgets.find((b) => b.id === id && b.userId === user?.id)

  if (!budget) {
    return (
      <Card>
        <p className="font-semibold text-slate-900">Budget not found.</p>
        <Button className="mt-4" onClick={() => navigate('/client/budgets')}>Back to budgets</Button>
      </Card>
    )
  }

  const progress = getBudgetProgress(budget)

  return (
    <>
      <PageTitle
        title={budget.name}
        sub="Budget details and progress."
        action={
          <Button variant="secondary" onClick={() => navigate('/client/budgets')}>
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      <Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{budget.name}</h3>
              <p className="text-sm text-slate-500">{budget.category}</p>
            </div>
            <Badge
              tone={
                getBudgetStatus(budget.spent, budget.limit) === 'healthy'
                  ? 'green'
                  : getBudgetStatus(budget.spent, budget.limit) === 'warning'
                    ? 'amber'
                    : 'red'
              }
            >
              {getBudgetStatus(budget.spent, budget.limit)}
            </Badge>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span>Spent: {formatCurrency(budget.spent)}</span>
              <span>Limit: {formatCurrency(budget.limit)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  progress >= 100 ? 'bg-rose-500' : progress >= 85 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{formatCurrency(budget.spent)}</div>
              <div className="text-xs text-slate-400">Spent</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(budget.limit)}</div>
              <div className="text-xs text-slate-400">Budget limit</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(budget.limit - budget.spent)}</div>
              <div className="text-xs text-slate-400">Remaining</div>
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}

export default BudgetDetails
