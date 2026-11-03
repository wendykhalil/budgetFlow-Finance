import { useState } from "react"

import { useNotifications } from "@/contexts/NotificationContext"

import Alert from "@/components/ui/Alert"

import Button from "@/components/ui/Button"

import Card from "@/components/ui/Card"

import EmptyState from "@/components/ui/EmptyState"

import Icon from "@/components/ui/Icon"

import LoadingSkeleton from "@/components/ui/LoadingSkeleton"

import Pagination from "@/components/ui/Pagination"

import PageTitle from "@/components/layout/PageTitle"

import { ConfirmModal } from "@/components/ui/Modal"

export function ClientNotifications() {
  const [notificationToDelete, setNotificationToDelete] = useState(null)

  const {
    notifications,

    unreadCount,

    pagination,

    loading,

    error,

    actionError,

    readingIds,

    deletingIds,

    markingAllAsRead,

    fetchNotifications,

    refreshNotifications,

    markNotificationAsRead,

    markAllNotificationsAsRead,

    deleteNotification,
  } = useNotifications()

  return (
    <>
      <PageTitle
        title="Notifications"
        sub="Updates and insights that help you stay on track."
        action={
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Export is unavailable in this demo"
          >
            <Icon name="download" className="size-4" /> Export unavailable
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4">
          <Alert
            type="error"
            title="Could not load notifications"
            message={error}
          />
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void refreshNotifications()}
          >
            Retry
          </Button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="mb-4">
          <Alert
            type="error"
            title="Could not update notifications"
            message={actionError}
          />
        </div>
      )}

      {unreadCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            You have {unreadCount} unread{" "}
            {unreadCount === 1 ? "notification" : "notifications"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={markingAllAsRead}
            onClick={() => void markAllNotificationsAsRead()}
          >
            {markingAllAsRead ? "Marking all as read..." : "Mark all as read"}
          </Button>
        </div>
      )}

      <Card className="divide-y divide-slate-100 p-0">
        {loading ? (
          <div className="p-5">
            <LoadingSkeleton lines={5} />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet."
            message="Updates and budget alerts will appear here."
            icon={<Icon name="bell" className="size-8" />}
          />
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex gap-4 border-b border-slate-100 p-5 last:border-0 ${
                notification.isRead ? "" : "bg-emerald-50/20"
              }`}
            >
              <span
                aria-label={notification.isRead ? "Read" : "Unread"}
                className={`mt-1 size-2 shrink-0 rounded-full ${getTypeColor(
                  notification.type,
                )}`}
              />
              <div className="flex-1">
                <div className="font-semibold">{notification.title}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {notification.message}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatDate(notification.createdAt)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!notification.isRead && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={readingIds.includes(notification.id)}
                      onClick={() =>
                        void markNotificationAsRead(notification.id)
                      }
                    >
                      {readingIds.includes(notification.id)
                        ? "Marking as read..."
                        : "Mark as read"}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deletingIds.includes(notification.id)}
                    onClick={() => setNotificationToDelete(notification)}
                  >
                    <span className="sr-only">
                      Delete notification: {notification.title}
                    </span>
                    {deletingIds.includes(notification.id)
                      ? "Deleting..."
                      : "Delete"}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      {!loading && pagination.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={(page) => void fetchNotifications(page)}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(notificationToDelete)}
        onClose={() => setNotificationToDelete(null)}
        onConfirm={() => {
          if (notificationToDelete) {
            void deleteNotification(notificationToDelete.id)
          }
        }}
        title="Delete notification?"
        message={`Delete "${notificationToDelete?.title ?? ""}"? This cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </>
  )
}

function getTypeColor(type) {
  switch (type) {
    case "budget_warning":
      return "bg-amber-500"

    case "budget_exceeded":

    case "transaction_deleted":
      return "bg-rose-500"

    case "transaction_created":
      return "bg-emerald-500"

    case "transaction_updated":

    default:
      return "bg-blue-500"
  }
}

function formatDate(dateString) {
  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) return "Date unavailable"

  const now = new Date()

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"

  if (diffDays === 1) return "Yesterday"

  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" })
}

export default ClientNotifications
