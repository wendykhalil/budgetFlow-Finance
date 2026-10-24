import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import SearchInput from '@/components/ui/SearchInput'
import { mockUsers } from '@/data/mockUsers'

export function AdminUsers() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filtered = useMemo(() => {
    let result = [...mockUsers]
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        (u) => u.firstName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
      )
    }
    if (statusFilter !== 'all') {
      result = result.filter((u) => u.status === statusFilter)
    }
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter)
    }
    return result
  }, [search, statusFilter, roleFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage)

  const handleSuspend = (id) => {
    const user = mockUsers.find((u) => u.id === id)
    if (user) {
      user.status = user.status === 'suspended' ? 'active' : 'suspended'
    }
  }

  return (
    <>
      <PageTitle
        title="Users management"
        sub={`Manage ${mockUsers.length} client and administrator accounts.`}
        action={
          <Button>
            <Icon name="plus" className="size-4" /> Add user
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput placeholder="Search users..." value={search} onChange={setSearch} />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
          >
            <option value="all">All roles</option>
            <option value="client">Client</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['User', 'Role', 'Status', 'Transactions', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((u) => (
              <tr key={u.id}>
                <td className="flex items-center gap-3 px-5 py-4">
                  <Avatar initials={u.avatar} color={u.avatarColor} size="sm" />
                  <div>
                    <b>{`${u.firstName} ${u.lastName}`}</b>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </td>
                <td>
                  <Badge tone={u.role === 'admin' ? 'blue' : 'neutral'} size="sm">
                    {u.role}
                  </Badge>
                </td>
                <td>
                  <Badge
                    tone={u.status === 'active' ? 'green' : u.status === 'pending' ? 'amber' : 'red'}
                    size="sm"
                  >
                    {u.status}
                  </Badge>
                </td>
                <td className="text-slate-500">{u.transactionsCount}</td>
                <td className="text-slate-500">
                  {new Date(u.joinedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
                </td>
                <td className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <Icon name="eye" className="size-4" />
                  </button>
                  <button
                    onClick={() => handleSuspend(u.id)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                  >
                    <Icon name={u.status === 'suspended' ? 'check' : 'close'} className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 flex justify-between text-sm text-slate-500">
        <span>Showing {filtered.length > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + itemsPerPage, filtered.length)} of {filtered.length}</span>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`grid size-8 place-items-center rounded-xl text-sm font-semibold ${
                page === currentPage
                  ? 'bg-[#155C4F] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

export default AdminUsers
