import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { transactions } from '@/data/mockTransactions'
import { categories } from '@/data/mockCategories'
import { generateId } from '@/utils/formatters'

export function TransactionNew() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('Credit card')
  const [note, setNote] = useState('')

  const categoryOptions = categories
    .filter((c) => c.type === type)
    .map((c) => ({ value: c.name, label: c.name }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!description || !amount) return

    const newTransaction = {
      id: generateId(),
      date,
      description,
      category,
      type,
      amount: parseFloat(amount),
      paymentMethod,
      status: 'completed',
      userId: 'usr_001',
      note,
    }

    transactions.unshift(newTransaction)
    navigate('/client/transactions')
  }

  return (
    <>
      <PageTitle
        title="Add transaction"
        sub="Create a new transaction record."
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
                onClick={() => setType('income')}
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
                onClick={() => setType('expense')}
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              prefix="€"
            />
            <Select
              label="Category"
              options={categoryOptions}
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

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="secondary" type="button" onClick={() => navigate('/client/transactions')}>
              Cancel
            </Button>
            <Button type="submit">Save transaction</Button>
          </div>
        </form>
      </Card>
    </>
  )
}

export default TransactionNew
