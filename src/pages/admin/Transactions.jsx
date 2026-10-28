import { useState, useMemo } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import SearchInput from '@/components/ui/SearchInput'
import { transactions } from '@/data/mockTransactions'
import { getUserById } from '@/data/mockUsers'
import { getRegisteredUsers } from '@/data/registeredUsers'

export function AdminTransactions() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    let result = [...transactions]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (t) => t.description.toLowerCase().includes(s) || t.category.toLowerCase().includes(s)
      )
    }
    if (typeFilter !== 'all') {
      result = result.filter((t) => t.type === typeFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter)
    }
    return result
  }, [search, typeFilter, statusFilter])

  return (
    <>
      <PageTitle
        title="Transactions management"
        sub="Review platform-wide transaction activity."
        action={<Button disabled title="Admin transaction creation is unavailable in this demo">Add record unavailable</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput placeholder="Search transactions..." value={search} onChange={setSearch} />
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
            aria-label="Filter by transaction status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
          <Button variant="secondary" size="sm" disabled title="Export is unavailable in this demo">
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['User', 'Description', 'Category', 'Type', 'Amount', 'Date', 'Status', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">No transactions match these filters.</td></tr>
            ) : filtered.map((t) => {
              const owner = getUserById(t.userId) || getRegisteredUsers().find((user) => user.id === t.userId)
              return (
              <tr key={t.id}>
                <td className="px-5 py-4">
                  <span className="font-semibold">
                    {owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown user'}
                  </span>
                </td>
                <td className="px-5 py-4 font-semibold">{t.description}</td>
                <td className="px-5 py-4">
                  <Badge tone="neutral" size="sm">{t.category}</Badge>
                </td>
                <td className="px-5 py-4">
                  <Badge tone={t.type === 'income' ? 'green' : 'neutral'} size="sm">
                    {t.type}
                  </Badge>
                </td>
                <td className={`px-5 py-4 font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {t.type === 'income' ? '+' : '−'}€{t.amount.toFixed(2)}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {new Date(t.date).toLocaleDateString('en-GB')}
                </td>
                <td className="px-5 py-4">
                  <Badge tone={t.status === 'completed' ? 'green' : 'amber'} size="sm">
                    {t.status}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <Button variant="ghost" size="sm" disabled title="Transaction details are unavailable in admin view">View unavailable</Button>
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

export default AdminTransactions
