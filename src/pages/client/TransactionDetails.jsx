import { useNavigate, useParams } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { transactions, getTransactionById } from '@/data/mockTransactions'

export function TransactionDetails() {
  const navigate = useNavigate()
  const { id } = useParams()
  const transaction = getTransactionById(id) || transactions[0]

  const handleDelete = () => {
    const idx = transactions.findIndex((t) => t.id === id)
    if (idx !== -1) transactions.splice(idx, 1)
    navigate('/client/transactions')
  }

  return (
    <>
      <PageTitle
        title="Transaction details"
        sub="View and manage transaction."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/client/transactions')}>
              <Icon name="arrow-left" className="size-4" /> Back
            </Button>
            <Button variant="outline" onClick={() => navigate(`/client/transactions/${id}/edit`)}>
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
            <div className={`mt-1 text-2xl font-bold ${transaction.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
              {transaction.amount >= 0 ? `+€${transaction.amount.toFixed(2)}` : `-€${Math.abs(transaction.amount).toFixed(2)}`}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Category</div>
            <div className="mt-1 font-semibold">{transaction.category}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Type</div>
            <div className="mt-1">
              <Badge tone={transaction.type === 'income' ? 'green' : 'neutral'}>
                {transaction.type}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Date</div>
            <div className="mt-1 font-semibold">{new Date(transaction.date).toLocaleDateString('en-GB')}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Payment method</div>
            <div className="mt-1 font-semibold">{transaction.paymentMethod}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Status</div>
            <div className="mt-1">
              <Badge tone={transaction.status === 'completed' ? 'green' : 'amber'}>
                {transaction.status}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Note</div>
            <div className="mt-1 font-semibold">{transaction.note || 'No note'}</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-6">
          <Button variant="secondary" onClick={() => navigate('/client/transactions')}>
            Back to transactions
          </Button>
          <button
            onClick={handleDelete}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Delete transaction
          </button>
        </div>
      </Card>
    </>
  )
}

export default TransactionDetails
