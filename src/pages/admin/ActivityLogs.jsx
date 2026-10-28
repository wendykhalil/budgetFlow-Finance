import { useState, useMemo } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import SearchInput from '@/components/ui/SearchInput'

export function AdminActivityLogs() {
  const [search, setSearch] = useState('')
  const activities = [
    { id: 1, user: 'Alex Martin', action: 'Created expense', resource: 'Transaction', date: 'Oct 24, 10:42', status: 'Success' },
    { id: 2, user: 'Sarah Wilson', action: 'Created budget', resource: 'Budget', date: 'Oct 24, 09:16', status: 'Success' },
    { id: 3, user: 'John Smith', action: 'Registered account', resource: 'User', date: 'Oct 23, 18:04', status: 'Pending' },
    { id: 4, user: 'Admin John', action: 'Modified Food', resource: 'Category', date: 'Oct 23, 14:22', status: 'Success' },
    { id: 5, user: 'Emma Johnson', action: 'Created income', resource: 'Transaction', date: 'Oct 22, 16:30', status: 'Success' },
    { id: 6, user: 'Michael Brown', action: 'Updated profile', resource: 'User', date: 'Oct 22, 14:15', status: 'Success' },
  ]

  const filtered = useMemo(() => {
    if (!search) return activities
    const s = search.toLowerCase()
    return activities.filter(
      (a) => a.user.toLowerCase().includes(s) || a.action.toLowerCase().includes(s) || a.resource.toLowerCase().includes(s)
    )
  }, [search])

  return (
    <>
      <PageTitle
        title="Activity & audit logs"
        sub="Illustrative static sample logs; this demo does not record live activity."
      />

      <div className="mb-5">
        <SearchInput placeholder="Search activity logs..." value={search} onChange={setSearch} />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-162.5 text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-400">
            <tr>
              {['User', 'Action', 'Resource', 'Date', 'Status'].map((h) => (
                <th key={h} className="px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-4 font-semibold">{a.user}</td>
                <td className="px-5 py-4">{a.action}</td>
                <td className="px-5 py-4">
                  <Badge tone="neutral" size="sm">{a.resource}</Badge>
                </td>
                <td className="px-5 py-4 text-slate-500">{a.date}</td>
                <td className="px-5 py-4">
                  <Badge tone={a.status === 'Success' ? 'green' : 'amber'} size="sm">
                    {a.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

export default AdminActivityLogs
