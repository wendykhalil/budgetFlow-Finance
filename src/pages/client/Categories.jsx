import { useAuth } from '@/contexts/AuthContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { categories } from '@/data/mockCategories'
import { transactions } from '@/data/mockTransactions'

export function ClientCategories() {
  const { user } = useAuth()
  const userCategories = categories.filter((category) => category.userId === user?.id)
  const userExpenseCategories = userCategories.filter((category) => category.type === 'expense')
  const userIncomeCategories = userCategories.filter((category) => category.type === 'income')
  return (
    <>
      <PageTitle
        title="Categories"
        sub="Organize transactions into meaningful groups."
        action={
          <Button disabled title="Category creation is unavailable in this demo">
            <Icon name="plus" className="size-4" /> Add category unavailable
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Badge tone="neutral">All categories ({userCategories.length})</Badge>
        <Badge tone="green">Income ({userIncomeCategories.length})</Badge>
        <Badge tone="red">Expense ({userExpenseCategories.length})</Badge>
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
            {userCategories.map((c) => {
              const categoryTransactions = transactions.filter(
                (transaction) => transaction.userId === c.userId && transaction.category === c.name,
              )
              const total = categoryTransactions.reduce(
                (sum, transaction) => sum + (transaction.type === 'income' ? transaction.amount : -transaction.amount),
                0,
              )
              return (
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
                <td className="text-slate-500">{categoryTransactions.length}</td>
                <td className="font-semibold">
                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero' }).format(total)}
                </td>
                <td>
                  <Button variant="ghost" size="sm" disabled title="Category editing is unavailable in this demo">
                    Edit unavailable
                  </Button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default ClientCategories
