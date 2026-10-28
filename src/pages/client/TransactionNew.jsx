import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { transactions, getTransactionById } from '@/data/mockTransactions'
import { categories } from '@/data/mockCategories'
import { generateId } from '@/utils/formatters'

export function TransactionNew() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const transaction = id ? getTransactionById(id) : null
  const isEditing = Boolean(id)
  const canEdit = transaction?.userId === user?.id
  const [description, setDescription] = useState(transaction?.description || '')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [type, setType] = useState(transaction?.type || 'expense')
  const [category, setCategory] = useState(transaction?.category || '')
  const [date, setDate] = useState(transaction?.date || new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod || 'Credit card')
  const [note, setNote] = useState(transaction?.note || '')
  const [error, setError] = useState('')

  const categoryOptions = categories
    .filter((c) => c.type === type && c.userId === user?.id)
    .map((c) => ({ value: c.name, label: c.name }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !category || !date) {
      setError('Enter a description, a positive amount, a category, and a date.')
      return
    }

    setError('')
    if (isEditing && canEdit) {
      Object.assign(transaction, {
        date,
        description: description.trim(),
        category,
        type,
        amount: parsedAmount,
        paymentMethod,
        note,
      })
    } else {
      transactions.unshift({
        id: generateId(),
        date,
        description: description.trim(),
        category,
        type,
        amount: parsedAmount,
        paymentMethod,
        status: 'completed',
        userId: user.id,
        note,
      })
    }

    navigate('/client/transactions')
  }

  if (isEditing && !canEdit) {
    return (
      <Card>
        <p className="font-semibold text-slate-900">Transaction not found.</p>
        <Button className="mt-4" onClick={() => navigate('/client/transactions')}>Back to transactions</Button>
      </Card>
    )
  }

  return (
    <>
      <PageTitle
        title={isEditing ? 'Edit transaction' : 'Add transaction'}
        sub={isEditing ? 'Update this transaction record.' : 'Create a new transaction record.'}
        action={
          <Button variant="secondary" onClick={() => navigate('/client/transactions')}>
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setType('income')
                  if (!categories.some((c) => c.name === category && c.type === 'income' && c.userId === user?.id)) setCategory('')
                }}
                aria-pressed={type === 'income'}
                className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                  type === 'income'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('expense')
                  if (!categories.some((c) => c.name === category && c.type === 'expense' && c.userId === user?.id)) setCategory('')
                }}
                aria-pressed={type === 'expense'}
                className={`flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
                  type === 'expense'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Expense
              </button>
            </div>

            <Input
              label="Description"
              placeholder="Grocery store"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input
              label="Amount"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              prefix="€"
            />
            <Select
              label="Category"
              options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Select
              label="Payment method"
              options={[
                { value: 'Credit card', label: 'Credit card' },
                { value: 'Debit card', label: 'Debit card' },
                { value: 'Bank transfer', label: 'Bank transfer' },
                { value: 'Cash', label: 'Cash' },
              ]}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
            <Input
              label="Note"
              placeholder="Optional note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" type="button" onClick={() => navigate('/client/transactions')}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save changes' : 'Save transaction'}</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

export default TransactionNew
