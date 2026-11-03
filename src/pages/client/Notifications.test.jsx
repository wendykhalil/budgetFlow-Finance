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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__notificationPageAuth,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api"

import NotificationProvider from "@/contexts/NotificationContext"

import ClientNotifications from "@/pages/client/Notifications"

const pageOneNotification = {
  id: "real-notification-1",

  type: "budget_warning",

  title: "Actual backend notification",

  message: "Loaded from the notification API.",

  isRead: false,

  createdAt: new Date().toISOString(),
}

function listResponse(page = 1) {
  return {
    notifications:
      page === 1
        ? [pageOneNotification]
        : [
            {
              ...pageOneNotification,

              id: "real-notification-2",

              title: "Second API notification",
            },
          ],

    pagination: { page, limit: 20, total: 21, totalPages: 2 },
  }
}

function renderPage() {
  return render(
    <NotificationProvider>
      <ClientNotifications />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()

  localStorage.setItem("budgetflow_token", "page-token")

  window.__notificationPageAuth = {
    user: { id: "page-user", role: "client" },

    logout: vi.fn(),
  }

  apiRequest.mockReset()

  apiRequest.mockImplementation(async (endpoint) =>
    endpoint.startsWith("notifications?page=")
      ? listResponse(
          Number(new URLSearchParams(endpoint.split("?")[1]).get("page")),
        )
      : { unreadCount: 1 },
  )
})

afterEach(() => {
  cleanup()

  delete window.__notificationPageAuth

  vi.clearAllMocks()
})

describe("ClientNotifications", () => {
  it("renders API notifications and does not render mock data or demo actions", async () => {
    renderPage()

    expect(await screen.findByText("Actual backend notification")).toBeTruthy()

    expect(screen.getByText("Loaded from the notification API.")).toBeTruthy()

    expect(screen.getByText("You have 1 unread notification")).toBeTruthy()

    expect(screen.queryByText("Your Food budget is at 84%.")).toBeNull()

    expect(screen.getByText("Mark all as read")).toBeTruthy()
    expect(screen.getByText("Mark as read")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /delete notification/i }),
    ).toBeTruthy()
  })

  it("shows loading and empty states", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return {
          notifications: [],

          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }
      }

      return { unreadCount: 0 }
    })

    renderPage()

    expect(document.querySelector(".animate-pulse")).toBeTruthy()

    expect(await screen.findByText("No notifications yet.")).toBeTruthy()
  })

  it("uses backend pagination metadata to load another page", async () => {
    renderPage()

    expect(await screen.findByText("Actual backend notification")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }))

    expect(await screen.findByText("Second API notification")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledWith(
      "notifications?page=2&limit=20",

      { token: "page-token" },
    )
  })

  it("shows an API error and retries the REST request", async () => {
    apiRequest

      .mockRejectedValueOnce(new Error("Service unavailable"))

      .mockResolvedValueOnce({ unreadCount: 1 })

      .mockResolvedValueOnce(listResponse())

      .mockResolvedValueOnce({ unreadCount: 1 })

    renderPage()

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Service unavailable",
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Actual backend notification")).toBeTruthy()

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })

  it("marks a notification as read from the page", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/real-notification-1/read") {
        return {
          notification: { ...pageOneNotification, isRead: true },
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderPage()
    fireEvent.click(await screen.findByText("Mark as read"))

    await waitFor(() => {
      expect(screen.queryByText(/You have 1 unread notification/)).toBeNull()
      expect(screen.getByLabelText("Read")).toBeTruthy()
    })
    expect(apiRequest).toHaveBeenCalledWith(
      "notifications/real-notification-1/read",
      { method: "PATCH", token: "page-token" },
    )
  })

  it("shows per-notification loading feedback while marking it as read", async () => {
    let resolveRead
    const pendingRead = new Promise((resolve) => {
      resolveRead = resolve
    })
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return Promise.resolve(listResponse())
      }
      if (endpoint === "notifications/unread-count") {
        return Promise.resolve({ unreadCount: 1 })
      }
      if (endpoint === "notifications/real-notification-1/read") {
        return pendingRead
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderPage()
    fireEvent.click(await screen.findByText("Mark as read"))

    expect(await screen.findByText("Marking as read...")).toBeTruthy()
    expect(screen.getByText("Delete").closest("button").disabled).toBe(false)

    await act(async () => {
      resolveRead({
        notification: { ...pageOneNotification, isRead: true },
      })
    })
    await waitFor(() => expect(screen.getByLabelText("Read")).toBeTruthy())
  })

  it("marks all notifications read through the page action", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/read-all") return { modifiedCount: 1 }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderPage()
    fireEvent.click(await screen.findByText("Mark all as read"))

    await waitFor(() => {
      expect(screen.queryByText(/You have 1 unread notification/)).toBeNull()
      expect(screen.getByLabelText("Read")).toBeTruthy()
    })
    expect(apiRequest).toHaveBeenCalledWith("notifications/read-all", {
      method: "PATCH",
      token: "page-token",
    })
  })

  it("confirms deletion before removing the notification", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return {
          notifications: [pageOneNotification],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/real-notification-1") {
        return { message: "Notification deleted." }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderPage()
    fireEvent.click(
      await screen.findByRole("button", {
        name: /delete notification: actual backend notification/i,
      }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/This cannot be undone/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(screen.queryByText("Actual backend notification")).toBeNull()
      expect(screen.queryByText(/You have 1 unread notification/)).toBeNull()
    })
    expect(apiRequest).toHaveBeenCalledWith(
      "notifications/real-notification-1",
      { method: "DELETE", token: "page-token" },
    )
  })

  it("shows mutation errors without changing the displayed notification", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/real-notification-1/read") {
        throw new Error("Read operation failed")
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderPage()
    fireEvent.click(await screen.findByText("Mark as read"))

    expect(await screen.findByText("Read operation failed")).toBeTruthy()
    expect(screen.getByText("Actual backend notification")).toBeTruthy()
    expect(screen.getByText(/You have 1 unread notification/)).toBeTruthy()
  })
})
