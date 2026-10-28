import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { mockUsers, getUserById } from '@/data/mockUsers'
import { deleteRegisteredUser, getRegisteredUsers, updateRegisteredUser } from '@/data/registeredUsers'
import { formatCurrency, transactions } from '@/data/mockTransactions'
import { budgets } from '@/data/mockBudgets'

export function AdminUserDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const user = getUserById(id) || getRegisteredUsers().find((entry) => entry.id === id)
  const [, refresh] = useState(0)
  const userHasRecords = transactions.some((transaction) => transaction.userId === id)
    || budgets.some((budget) => budget.userId === id)
  const userTransactions = transactions.filter((transaction) => transaction.userId === id)
  const monthPrefix = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const monthTransactions = userTransactions.filter((transaction) => transaction.date.startsWith(monthPrefix))
  const monthlyIncome = monthTransactions.filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const monthlyExpenses = monthTransactions.filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const savingsRate = monthlyIncome ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : null

  if (!user) {
    return (
      <Card>
        <p className="font-semibold text-slate-900">User not found.</p>
        <Button className="mt-4" onClick={() => navigate('/admin/users')}>Back to users</Button>
      </Card>
    )
  }

  const handleStatusChange = () => {
    const status = user.status === 'suspended' ? 'active' : 'suspended'
    const mockUser = getUserById(id)
    if (mockUser) mockUser.status = status
    else updateRegisteredUser(id, { status })
    refresh((value) => value + 1)
  }

  const handleDelete = () => {
    if (!window.confirm(`Delete ${user.firstName} ${user.lastName}? This cannot be undone.`)) return
    const index = mockUsers.findIndex((entry) => entry.id === id)
    if (index !== -1) mockUsers.splice(index, 1)
    else deleteRegisteredUser(id)
    navigate('/admin/users')
  }

  return (
    <>
      <PageTitle
        title="User details"
        sub="View and manage user account."
        action={
          <Button variant="secondary" onClick={() => navigate('/admin/users')}>
            <Icon name="arrow-left" className="size-4" /> Back
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="text-center">
          <Avatar initials={user.avatar} size="xl" color={user.avatarColor} />
          <div className="mt-4 text-xl font-bold">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-sm text-slate-500">{user.email}</div>
          <div className="mt-3">
            <Badge tone={user.status === 'active' ? 'green' : user.status === 'pending' ? 'amber' : 'red'}>
              {user.status}
            </Badge>
          </div>
          <Badge tone={user.role === 'admin' ? 'blue' : 'neutral'} className="mt-2">
            {user.role}
          </Badge>
        </Card>

        <div className="space-y-5">
          <Card>
            <div className="font-bold mb-4">Account information</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-xs text-slate-400">First name</span>
                <div className="mt-1 font-semibold">{user.firstName}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Last name</span>
                <div className="mt-1 font-semibold">{user.lastName}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Email</span>
                <div className="mt-1 font-semibold">{user.email}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Phone</span>
                <div className="mt-1 font-semibold">{user.phone || 'Not set'}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Role</span>
                <div className="mt-1 font-semibold">{user.role}</div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Status</span>
                <div className="mt-1 font-semibold">{user.status}</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="font-bold mb-4">Activity summary</div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold">{userTransactions.length}</div>
                <div className="text-xs text-slate-400">Transactions</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</div>
                <div className="text-xs text-slate-400">Spent this month</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold">{savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}</div>
                <div className="text-xs text-slate-400">Savings rate</div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleStatusChange}>
              {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
            <Button variant="secondary" disabled title="Password resets require a backend service">
              Password reset unavailable
            </Button>
            <button
              onClick={handleDelete}
              disabled={userHasRecords}
              title={userHasRecords ? 'Users with transactions or budgets cannot be deleted' : undefined}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {userHasRecords ? 'User has records' : 'Delete user'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminUserDetail
