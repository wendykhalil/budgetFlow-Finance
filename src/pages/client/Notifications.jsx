import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { notifications as initialNotifications, getNotificationsByUser } from '@/data/mockNotifications'
import { getUnreadCount } from '@/data/mockNotifications'

export function ClientNotifications() {
  const [notifications, setNotifications] = useState(getNotificationsByUser('usr_001'))

  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  const markAsRead = (id) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, status: 'read' })))
  }

  const deleteNotification = (id) => {
    setNotifications(notifications.filter((n) => n.id !== id))
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500'
      case 'error':
        return 'bg-rose-500'
      case 'warning':
        return 'bg-amber-500'
      case 'info':
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <>
      <PageTitle
        title="Notifications"
        sub="Updates and insights that help you stay on track."
        action={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllAsRead}>
                Mark all as read
              </Button>
            )}
            <Button variant="secondary" size="sm">
              <Icon name="download" className="size-4" /> Export
            </Button>
          </div>
        }
      />

      {unreadCount > 0 && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          You have {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
        </div>
      )}

      <Card className="divide-y divide-slate-100 p-0">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No notifications yet.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex gap-4 border-b border-slate-100 p-5 last:border-0 ${
                n.status === 'unread' ? 'bg-emerald-50/20' : ''
              }`}
            >
              <span className="mt-1 size-2 shrink-0 rounded-full bg-slate-300" />
              <div className="flex-1">
                <div className="font-semibold">{n.title}</div>
                <div className="mt-1 text-sm text-slate-500">{n.message || n.message}</div>
                <div className="mt-1 text-xs text-slate-400">{formatDate(n.date)}</div>
              </div>
              <div className="flex items-center gap-2">
                {n.status === 'unread' && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Mark as read
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Icon name="close" className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  )
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export default ClientNotifications
