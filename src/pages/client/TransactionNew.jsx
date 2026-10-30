import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { apiRequest } from '@/lib/api'
import { categories } from '@/data/mockCategories'
import { useTransactions } from '@/contexts/TransactionContext'

export function TransactionNew() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { upsertTransaction } = useTransactions()
  const isEditing = Boolean(id)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('Credit card')
  const [note, setNote] = useState('')
  const [loadingTransaction, setLoadingTransaction] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submitLockRef = useRef(false)

  const categoryOptions = categories
    .filter((item) => item.type === type)
    .map((item) => ({ value: item.name, label: item.name }))
  if (category && !categoryOptions.some((option) => option.value === category)) {
    categoryOptions.push({ value: category, label: category })
  }

  useEffect(() => {
    if (!isEditing) return
    let isMounted = true

    async function loadTransaction() {
      setLoadingTransaction(true)
      setError('')
      try {
        const response = await apiRequest(`transactions/${id}`, {
          token: localStorage.getItem('budgetflow_token'),
        })
        if (!response?.transaction) {
          throw new Error('The transactions service returned an invalid response.')
        }
        if (!isMounted) return
        const transaction = response.transaction
        setDescription(transaction.description || '')
        setAmount(String(transaction.amount ?? ''))
        setType(transaction.type || 'expense')
        setCategory(transaction.category || '')
        setDate(transaction.date || '')
        setPaymentMethod(transaction.paymentMethod || '')
        setNote(transaction.note || '')
      } catch (requestError) {
        if (isMounted) setError(requestError.message || 'Could not load this transaction.')
      } finally {
        if (isMounted) setLoadingTransaction(false)
      }
    }

    loadTransaction()
    return () => {
      isMounted = false
    }
  }, [id, isEditing])

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLockRef.current) return
    const parsedAmount = Number(amount)
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00.000Z`)
      : null
    const validDate = parsedDate &&
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === date
    if (
      !description.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      !category.trim() ||
      !['income', 'expense'].includes(type) ||
      !validDate
    ) {
      setError('Enter a description, positive amount, category, valid date, and transaction type.')
      return
    }

    setError('')
    submitLockRef.current = true
    setSubmitting(true)
    try {
      const body = {
        date,
        description: description.trim(),
        category: category.trim(),
        type,
        amount: parsedAmount,
        paymentMethod,
        note,
      }
      if (!isEditing) body.status = 'completed'

      const response = await apiRequest(
        isEditing ? `transactions/${id}` : 'transactions',
        {
          method: isEditing ? 'PATCH' : 'POST',
          token: localStorage.getItem('budgetflow_token'),
          body,
        },
      )
      if (!response?.transaction?.id) {
        throw new Error('The transactions service returned an invalid response.')
      }
      upsertTransaction(response.transaction)

      navigate('/client/transactions', {
        state: { successMessage: isEditing ? 'Transaction updated.' : 'Transaction created.' },
      })
    } catch (requestError) {
      setError(requestError.message || `Could not ${isEditing ? 'update' : 'create'} the transaction.`)
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
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
        {loadingTransaction ? (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Loading transaction...</p>
        ) : error && isEditing && !description ? (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-rose-600">{error}</p>
            <Button className="mt-4" onClick={() => navigate('/client/transactions')}>
              Back to transactions
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2 flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setType('income')
                    if (!categories.some((item) => item.name === category && item.type === 'income')) setCategory('')
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
                    if (!categories.some((item) => item.name === category && item.type === 'expense')) setCategory('')
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
                onChange={(event) => setDescription(event.target.value)}
              />
              <Input
                label="Amount"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                prefix="€"
              />
              <Select
                label="Category"
                options={[{ value: '', label: 'Select category' }, ...categoryOptions]}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Select
                label="Payment method"
                options={[
                  { value: '', label: 'Select payment method' },
                  { value: 'Credit card', label: 'Credit card' },
                  { value: 'Debit card', label: 'Debit card' },
                  { value: 'Bank transfer', label: 'Bank transfer' },
                  { value: 'Cash', label: 'Cash' },
                ]}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              />
              <Input
                label="Note"
                placeholder="Optional note..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-6">
              <Button variant="secondary" type="button" onClick={() => navigate('/client/transactions')}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Save transaction'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </>
  )
}

export default TransactionNew
