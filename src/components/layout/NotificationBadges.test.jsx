import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { MemoryRouter } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__notificationBadgeAuth,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

import Header from "@/components/layout/Header"

import Sidebar from "@/components/layout/Sidebar"

import {
  NotificationProvider,
  useNotifications,
} from "@/contexts/NotificationContext"

import { apiRequest } from "@/lib/api"

const notifications = [
  {
    id: "notification-1",

    type: "budget_warning",

    title: "First notification",

    message: "First message",

    isRead: false,

    createdAt: "2026-11-02T08:00:00.000Z",
  },

  {
    id: "notification-2",

    type: "transaction_created",

    title: "Second notification",

    message: "Second message",

    isRead: false,

    createdAt: "2026-11-02T08:01:00.000Z",
  },

  {
    id: "notification-3",

    type: "budget_exceeded",

    title: "Third notification",

    message: "Third message",

    isRead: false,

    createdAt: "2026-11-02T08:02:00.000Z",
  },
]

const clientNavigation = [
  { name: "Dashboard", icon: "grid", path: "/client/dashboard" },

  { name: "Notifications", icon: "bell", path: "/client/notifications" },
]

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function NotificationActions() {
  const {
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
  } = useNotifications()

  return (
    <div>
      <button onClick={() => void markNotificationAsRead("notification-1")}>
        Read first
      </button>
      <button onClick={() => void deleteNotification("notification-2")}>
        Delete second
      </button>
      <button onClick={() => void markAllNotificationsAsRead()}>
        Read all remaining
      </button>
    </div>
  )
}

function NotificationChrome() {
  return (
    <>
      <Header role="client" />
      <Sidebar navItems={clientNavigation} role="client" />
      <NotificationActions />
    </>
  )
}

function renderNotificationChrome() {
  return render(
    <MemoryRouter>
      <NotificationProvider>
        <NotificationChrome />
      </NotificationProvider>
    </MemoryRouter>,
  )
}

function getNotificationLinks() {
  const headerLink = within(screen.getByRole("banner")).getByRole("link", {
    name: "Notifications",
  })

  const sidebar = screen.getByRole("navigation", { name: "Main navigation" })

  const sidebarLink = within(sidebar).getByRole("link", {
    name: /^Notifications/,
  })

  return { headerLink, sidebarLink }
}

function expectBothBadges(label) {
  const { headerLink, sidebarLink } = getNotificationLinks()

  expect(within(headerLink).getByText(label)).toBeTruthy()

  expect(within(sidebarLink).getByText(label)).toBeTruthy()
}

beforeEach(() => {
  localStorage.clear()

  localStorage.setItem("budgetflow_token", "token-1")

  window.__notificationBadgeAuth = {
    user: { id: "user-1", role: "client" },

    logout: vi.fn(),
  }

  apiRequest.mockReset()
})

afterEach(() => {
  cleanup()

  delete window.__notificationBadgeAuth

  vi.clearAllMocks()
})

describe("shared notification badges", () => {
  it("synchronizes Header and Sidebar across actions and user sessions", async () => {
    const pendingSecondUserCount = deferred()
    const failedSessionCount = deferred()

    apiRequest.mockImplementation(async (endpoint, { token } = {}) => {
      if (endpoint.startsWith("notifications?page=")) {
        return {
          notifications: token === "token-3" ? notifications : [],

          pagination: {
            page: 1,

            limit: 20,

            total: token === "token-3" ? notifications.length : 0,

            totalPages: token === "token-3" ? 1 : 0,
          },
        }
      }

      if (endpoint === "notifications/unread-count") {
        if (token === "token-1") return { unreadCount: 3 }

        if (token === "token-2") return pendingSecondUserCount.promise

        if (token === "token-3") return { unreadCount: 3 }

        if (token === "token-4") return failedSessionCount.promise
      }

      if (endpoint === "notifications/notification-1/read") {
        return {
          notification: { ...notifications[0], isRead: true },
        }
      }

      if (endpoint === "notifications/notification-2") {
        return { message: "Notification deleted." }
      }

      if (endpoint === "notifications/read-all") {
        return { modifiedCount: 1 }
      }

      throw new Error(`Unexpected API request: ${endpoint}`)
    })

    const view = renderNotificationChrome()

    await waitFor(() => expectBothBadges("3"))

    window.__notificationBadgeAuth = {
      user: { id: "user-2", role: "client" },

      logout: vi.fn(),
    }

    localStorage.setItem("budgetflow_token", "token-2")

    view.rerender(
      <MemoryRouter>
        <NotificationProvider>
          <NotificationChrome />
        </NotificationProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const { headerLink, sidebarLink } = getNotificationLinks()

      expect(headerLink.querySelector("span")).toBeNull()

      expect(sidebarLink.querySelector("span")).toBeNull()
    })

    await act(async () => {
      pendingSecondUserCount.resolve({ unreadCount: 101 })
    })
    await waitFor(() => expectBothBadges("99+"))

    window.__notificationBadgeAuth = {
      user: { id: "user-4", role: "client" },
      logout: vi.fn(),
    }
    localStorage.setItem("budgetflow_token", "token-4")
    view.rerender(
      <MemoryRouter>
        <NotificationProvider>
          <NotificationChrome />
        </NotificationProvider>
      </MemoryRouter>,
    )
    await waitFor(() => {
      const { headerLink, sidebarLink } = getNotificationLinks()
      expect(headerLink.querySelector("span")).toBeNull()
      expect(sidebarLink.querySelector("span")).toBeNull()
    })
    await act(async () => {
      failedSessionCount.reject(new Error("Unread count unavailable"))
    })
    await waitFor(() => {
      const { headerLink, sidebarLink } = getNotificationLinks()
      expect(headerLink.querySelector("span")).toBeNull()
      expect(sidebarLink.querySelector("span")).toBeNull()
    })

    window.__notificationBadgeAuth = { user: null, logout: vi.fn() }

    localStorage.removeItem("budgetflow_token")

    view.rerender(
      <MemoryRouter>
        <NotificationProvider>
          <NotificationChrome />
        </NotificationProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      const { headerLink, sidebarLink } = getNotificationLinks()

      expect(headerLink.querySelector("span")).toBeNull()

      expect(sidebarLink.querySelector("span")).toBeNull()
    })

    window.__notificationBadgeAuth = {
      user: { id: "user-3", role: "client" },

      logout: vi.fn(),
    }

    localStorage.setItem("budgetflow_token", "token-3")

    view.rerender(
      <MemoryRouter>
        <NotificationProvider>
          <NotificationChrome />
        </NotificationProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expectBothBadges("3"))

    fireEvent.click(screen.getByText("Read first"))

    await waitFor(() => expectBothBadges("2"))

    fireEvent.click(screen.getByText("Delete second"))

    await waitFor(() => expectBothBadges("1"))

    fireEvent.click(screen.getByText("Read all remaining"))

    await waitFor(() => {
      const { headerLink, sidebarLink } = getNotificationLinks()

      expect(headerLink.querySelector("span")).toBeNull()

      expect(sidebarLink.querySelector("span")).toBeNull()
    })
  })
})
