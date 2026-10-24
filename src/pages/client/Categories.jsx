import { useNavigate } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { categories, expenseCategories, incomeCategories } from '@/data/mockCategories'

export function ClientCategories() {
  const navigate = useNavigate()
  const stats = [
    ['Food', 'Expense', '24', '€420'],
    ['Housing', 'Expense', '2', '€750'],
    ['Transport', 'Expense', '18', '€280'],
    ['Shopping', 'Expense', '9', '€260'],
    ['Utilities', 'Expense', '5', '€240'],
    ['Entertainment', 'Expense', '7', '€150'],
    ['Salary', 'Income', '1', '€3,200'],
    ['Freelance', 'Income', '3', '€650'],
  ]

  return (
    <>
      <PageTitle
        title="Categories"
        sub="Organize transactions into meaningful groups."
        action={
          <Button onClick={() => navigate('/client/categories')}>
            <Icon name="plus" className="size-4" /> Add category
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Badge tone="neutral">All categories ({categories.length})</Badge>
        <Badge tone="green">Income ({incomeCategories.length})</Badge>
        <Badge tone="red">Expense ({expenseCategories.length})</Badge>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-150 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['Category', 'Type', 'Transactions', 'Total amount', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c, i) => (
              <tr key={c.id}>
                <td className="flex items-center gap-3 px-5 py-4 font-bold">
                  <span
                    className="grid size-9 place-items-center rounded-lg"
                    style={{ backgroundColor: `${c.color}20`, color: c.color }}
                  >
                    <Icon name={c.icon || 'tag'} className="size-4" />
                  </span>
                  {c.name}
                </td>
                <td>
                  <Badge tone={c.type === 'income' ? 'green' : 'neutral'} size="sm">
                    {c.type}
                  </Badge>
                </td>
                <td className="text-slate-500">{c.transactionCount || Math.floor(Math.random() * 30)}</td>
                <td className="font-semibold">
                  {c.type === 'income' ? '+€0.00' : '-€0.00'}
                </td>
                <td>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default ClientCategories
