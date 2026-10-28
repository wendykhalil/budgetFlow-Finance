import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import SearchInput from '@/components/ui/SearchInput'
import { useToast } from '@/components/ui/Toast'
import { transactions, formatAmount } from '@/data/mockTransactions'
import { categories } from '@/data/mockCategories'
import { filterTransactions, paginate } from '@/utils/formatters'

export function ClientTransactions() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('this-month')
  const [currentPage, setCurrentPage] = useState(1)
  const [transactionsVersion, setTransactionsVersion] = useState(0)
  const itemsPerPage = 10

  const filtered = useMemo(() => {
    return filterTransactions(transactions.filter((t) => t.userId === user?.id), {
      search,
      type: typeFilter,
      category: categoryFilter,
      date: dateFilter,
    })
  }, [search, typeFilter, categoryFilter, dateFilter, user?.id, transactionsVersion])

  const paginated = useMemo(() => {
    return paginate(filtered, currentPage, itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [filtered.length])

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
    if (currentPage > lastPage) setCurrentPage(lastPage)
  }, [currentPage, filtered.length])

  const handleDelete = (id) => {
    const idx = transactions.findIndex((t) => t.id === id)
    if (idx !== -1) {
      transactions.splice(idx, 1)
      setTransactionsVersion((version) => version + 1)
    }
  }

  return (
    <>
      <PageTitle
        title="Transactions"
        sub="Track, search, and manage all your account activity."
        action={
          <Button onClick={() => navigate('/client/transactions/new')}>
            <Icon name="plus" className="size-4" /> Add transaction
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput
            placeholder="Search transactions..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter by transaction type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
          <select
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-year">This Year</option>
          </select>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All categories</option>
            {categories.filter((category) => category.userId === user?.id).map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" disabled title="Export is unavailable in this demo">
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                {['Date', 'Description', 'Category', 'Type', 'Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    No transactions found. Try adjusting or clearing your filters.
                  </td>
                </tr>
              ) : (
                paginated.items.map((t) => {
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                        {formatDateShort(t.date)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold">{t.description}</div>
                        {t.note && <div className="text-xs text-slate-400">{t.note}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone="neutral" size="sm">{t.category}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{t.type}</td>
                      <td className={`px-5 py-4 font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {formatAmount(t.type === 'expense' ? -t.amount : t.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={t.status === 'completed' ? 'green' : 'amber'} size="sm">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`View transaction ${t.description}`}
                            onClick={() => navigate(`/client/transactions/${t.id}`)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <Icon name="eye" className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete transaction ${t.description}`}
                            onClick={() => handleDelete(t.id)}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            <Icon name="trash" className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <span>
          Showing {paginated.totalItems === 0 ? 0 : paginated.startIndex}–{paginated.endIndex} of {paginated.totalItems}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={paginated.totalPages === 0 || currentPage >= paginated.totalPages} onClick={() => setCurrentPage((p) => Math.min(p + 1, paginated.totalPages))}>
            Next
          </Button>
        </div>
      </div>
    </>
  )
}

function formatDateShort(dateString) {
  const options = { month: 'short', day: 'numeric' }
  return new Date(dateString).toLocaleDateString('en-GB', options)
}

export default ClientTransactions
