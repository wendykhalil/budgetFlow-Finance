import { useParams } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { mockUsers, getUserById } from '@/data/mockUsers'

export function AdminUserDetail() {
  const { id } = useParams()
  const user = getUserById(id) || mockUsers[0]

  return (
    <>
      <PageTitle
        title="User details"
        sub="View and manage user account."
        action={
          <Button variant="secondary" onClick={() => window.history.back()}>
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
                <div className="text-2xl font-bold">{user.transactionsCount}</div>
                <div className="text-xs text-slate-400">Transactions</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold">€2,140</div>
                <div className="text-xs text-slate-400">Spent this month</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <div className="text-2xl font-bold">4.2%</div>
                <div className="text-xs text-slate-400">Savings rate</div>
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => {}}>
              {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
            <Button variant="secondary" onClick={() => {}}>
              Reset password
            </Button>
            <button className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700">
              Delete user
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default AdminUserDetail
