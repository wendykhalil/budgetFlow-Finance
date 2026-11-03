import { useNotifications } from "@/contexts/NotificationContext"

export function NotificationBadge({ className = "" }) {
  const { unreadCount } = useNotifications()

  if (unreadCount <= 0) return null

  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-5 text-white ${className}`}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  )
}

export default NotificationBadge
