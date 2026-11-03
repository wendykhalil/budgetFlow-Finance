import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__notificationTestAuth,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api"

import {
  NotificationProvider,
  useNotifications,
} from "@/contexts/NotificationContext"

const firstNotification = {
  id: "notification-1",

  type: "budget_warning",

  title: "Budget warning from API",

  message: "A real notification response.",

  isRead: false,

  createdAt: "2026-11-02T08:00:00.000Z",
}

function createSocket() {
  const handlers = new Map()
  const socket = {
    connected: false,
    handlers,
    on: vi.fn((event, callback) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event).add(callback)
      return socket
    }),
    off: vi.fn((event, callback) => {
      handlers.get(event)?.delete(callback)
      return socket
    }),
    emitFromServer(event, payload) {
      for (const callback of handlers.get(event) || []) callback(payload)
    },
  }
  return socket
}

function listResponse(notifications = [firstNotification], page = 1) {
  return {
    notifications,

    pagination: { page, limit: 20, total: 1, totalPages: 1 },
  }
}

function deferred() {
  let resolve

  let reject

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise

    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function NotificationConsumer() {
  const {
    notifications,

    unreadCount,

    pagination,

    loading,

    error,

    fetchNotifications,

    refreshNotifications,

    actionError,

    readingIds,

    deletingIds,

    markingAllAsRead,

    markNotificationAsRead,

    markAllNotificationsAsRead,

    deleteNotification,
  } = useNotifications()

  return (
    <div>
      <span>{loading ? "Loading notifications" : "Notifications loaded"}</span>
      <span data-testid="unread-count">{unreadCount}</span>
      <span data-testid="current-page">{pagination.page}</span>
      {error && <span role="alert">{error}</span>}
      {actionError && <span role="alert">{actionError}</span>}
      <span data-testid="reading-ids">{readingIds.join(",")}</span>
      <span data-testid="deleting-ids">{deletingIds.join(",")}</span>
      <span data-testid="marking-all">{String(markingAllAsRead)}</span>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id}>
            <span>{notification.title}</span>
            <span>{notification.isRead ? "read" : "unread"}</span>
          </li>
        ))}
      </ul>
      <button onClick={() => void fetchNotifications(2)}>Load page 2</button>
      <button onClick={() => void refreshNotifications()}>Refresh</button>
      {notifications.map((notification) => (
        <div key={`actions-${notification.id}`}>
          <button onClick={() => void markNotificationAsRead(notification.id)}>
            Read {notification.id}
          </button>
          <button onClick={() => void deleteNotification(notification.id)}>
            Delete {notification.id}
          </button>
        </div>
      ))}
      <button onClick={() => void markAllNotificationsAsRead()}>
        Read all
      </button>
    </div>
  )
}

function renderNotificationProvider() {
  return render(
    <NotificationProvider>
      <NotificationConsumer />
    </NotificationProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()

  localStorage.setItem("budgetflow_token", "token-1")

  window.__notificationTestAuth = {
    user: { id: "user-1", role: "client" },

    logout: vi.fn(),

    socket: null,
  }

  apiRequest.mockReset()

  apiRequest.mockImplementation(async (endpoint) =>
    endpoint.startsWith("notifications?page=")
      ? listResponse()
      : { unreadCount: 1 },
  )
})

afterEach(() => {
  cleanup()

  delete window.__notificationTestAuth

  vi.clearAllMocks()
})

describe("NotificationContext", () => {
  it("loads the authenticated notification page and unread count", async () => {
    renderNotificationProvider()

    expect(await screen.findByText("Budget warning from API")).toBeTruthy()

    expect(screen.getByTestId("unread-count").textContent).toBe("1")

    expect(apiRequest).toHaveBeenCalledWith(
      "notifications?page=1&limit=20",

      { token: "token-1" },
    )

    expect(apiRequest).toHaveBeenCalledWith("notifications/unread-count", {
      token: "token-1",
    })
  })

  it("exposes API errors and can retry the failed request", async () => {
    apiRequest

      .mockRejectedValueOnce(new Error("Notifications unavailable"))

      .mockResolvedValueOnce({ unreadCount: 1 })

      .mockResolvedValueOnce(listResponse())

      .mockResolvedValueOnce({ unreadCount: 1 })

    renderNotificationProvider()

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Notifications unavailable",
    )

    fireEvent.click(screen.getByText("Refresh"))

    expect(await screen.findByText("Budget warning from API")).toBeTruthy()

    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("reports an unexpected notification response instead of accepting it", async () => {
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint.startsWith("notifications?page=")
        ? { notifications: [], pagination: {} }
        : { unreadCount: 0 },
    )

    renderNotificationProvider()

    expect((await screen.findByRole("alert")).textContent).toContain(
      "invalid response",
    )
  })

  it("clears notification data when the user logs out", async () => {
    const view = renderNotificationProvider()

    expect(await screen.findByText("Budget warning from API")).toBeTruthy()

    window.__notificationTestAuth = {
      user: null,

      logout: vi.fn(),
    }

    localStorage.removeItem("budgetflow_token")

    view.rerender(
      <NotificationProvider>
        <NotificationConsumer />
      </NotificationProvider>,
    )

    await waitFor(() =>
      expect(screen.queryByText("Budget warning from API")).toBeNull(),
    )

    expect(screen.getByTestId("unread-count").textContent).toBe("0")
  })

  it("does not expose stale notifications after switching users", async () => {
    const previousList = deferred()

    apiRequest.mockImplementation((endpoint, { token }) => {
      if (endpoint.startsWith("notifications?page=")) {
        return token === "token-1"
          ? previousList.promise
          : Promise.resolve(
              listResponse([
                {
                  ...firstNotification,
                  id: "new-user-note",
                  title: "User two notification",
                },
              ]),
            )
      }

      return Promise.resolve({ unreadCount: token === "token-1" ? 1 : 3 })
    })

    const view = renderNotificationProvider()

    window.__notificationTestAuth = {
      user: { id: "user-2", role: "client" },

      logout: vi.fn(),
    }

    localStorage.setItem("budgetflow_token", "token-2")

    view.rerender(
      <NotificationProvider>
        <NotificationConsumer />
      </NotificationProvider>,
    )

    expect(await screen.findByText("User two notification")).toBeTruthy()

    await act(async () =>
      previousList.resolve(listResponse([firstNotification])),
    )

    expect(screen.queryByText("Budget warning from API")).toBeNull()

    expect(screen.getByTestId("unread-count").textContent).toBe("3")
  })

  it("loads the requested page and adopts its pagination metadata", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint === "notifications?page=2&limit=20") {
        return {
          notifications: [
            {
              ...firstNotification,
              id: "page-two",
              title: "Page two notification",
            },
          ],

          pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
        }
      }

      return endpoint.startsWith("notifications?page=")
        ? {
            ...listResponse(),

            pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
          }
        : { unreadCount: 1 }
    })

    renderNotificationProvider()

    expect(await screen.findByText("Budget warning from API")).toBeTruthy()

    fireEvent.click(screen.getByText("Load page 2"))

    expect(await screen.findByText("Page two notification")).toBeTruthy()

    expect(screen.getByTestId("current-page").textContent).toBe("2")

    expect(apiRequest).toHaveBeenCalledWith(
      "notifications?page=2&limit=20",

      { token: "token-1" },
    )
  })

  it("does not call the notifications API without an authenticated user", () => {
    window.__notificationTestAuth = { user: null, logout: vi.fn() }

    renderNotificationProvider()

    expect(screen.getByText("Notifications loaded")).toBeTruthy()

    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("increments immediately, refreshes the list, and ignores duplicate or foreign events", async () => {
    const socket = createSocket()
    const pendingRefreshCount = deferred()
    let listRequestCount = 0
    let countRequestCount = 0
    window.__notificationTestAuth.socket = socket

    apiRequest.mockImplementation((endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        listRequestCount += 1
        return Promise.resolve(
          listRequestCount === 1
            ? {
                notifications: [],
                pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
              }
            : listResponse([
                {
                  ...firstNotification,
                  id: "socket-notification",
                  title: "Socket notification",
                },
              ]),
        )
      }

      if (endpoint === "notifications/unread-count") {
        countRequestCount += 1
        return countRequestCount === 1
          ? Promise.resolve({ unreadCount: 2 })
          : pendingRefreshCount.promise
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    await waitFor(() =>
      expect(screen.getByTestId("unread-count").textContent).toBe("2"),
    )

    const event = {
      id: "socket-notification",
      userId: "user-1",
      isRead: false,
    }
    act(() => socket.emitFromServer("notification:created", event))

    expect(screen.getByTestId("unread-count").textContent).toBe("3")
    expect(await screen.findByText("Socket notification")).toBeTruthy()
    expect(listRequestCount).toBe(2)
    expect(countRequestCount).toBe(2)

    act(() => {
      socket.emitFromServer("notification:created", event)
      socket.emitFromServer("notification:created", {
        ...event,
        id: "foreign-notification",
        userId: "user-2",
      })
    })
    expect(screen.getByTestId("unread-count").textContent).toBe("3")
    expect(listRequestCount).toBe(2)
    expect(countRequestCount).toBe(2)

    await act(async () => pendingRefreshCount.resolve({ unreadCount: 3 }))
    expect(screen.getByTestId("unread-count").textContent).toBe("3")
  })

  it("removes notification listeners on unmount", async () => {
    const socket = createSocket()
    window.__notificationTestAuth.socket = socket
    const view = renderNotificationProvider()

    await screen.findByText("Budget warning from API")
    expect(socket.handlers.get("notification:created")?.size).toBe(1)

    view.unmount()

    expect(socket.handlers.get("notification:created")?.size).toBe(0)
    expect(socket.off).toHaveBeenCalledWith(
      "notification:created",
      expect.any(Function),
    )
    expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function))
  })

  it("refreshes the unread count and current page after a reconnect", async () => {
    const socket = createSocket()
    window.__notificationTestAuth.socket = socket
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint.startsWith("notifications?page=")
        ? listResponse()
        : { unreadCount: 1 },
    )

    renderNotificationProvider()
    await screen.findByText("Budget warning from API")
    expect(apiRequest).toHaveBeenCalledTimes(2)

    act(() => socket.emitFromServer("connect"))
    expect(apiRequest).toHaveBeenCalledTimes(2)

    socket.connected = true
    act(() => socket.emitFromServer("connect"))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(4))
  })

  it("keeps REST usable when the shared socket emits a connection error", async () => {
    const socket = createSocket()
    window.__notificationTestAuth.socket = socket
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint.startsWith("notifications?page=")
        ? listResponse()
        : { unreadCount: 1 },
    )

    renderNotificationProvider()
    expect(await screen.findByText("Budget warning from API")).toBeTruthy()

    expect(() =>
      act(() =>
        socket.emitFromServer("connect_error", new Error("Socket unavailable")),
      ),
    ).not.toThrow()

    await act(async () => {
      await screen.getByText("Refresh").click()
    })
    expect(apiRequest).toHaveBeenCalledWith("notifications?page=1&limit=20", {
      token: "token-1",
    })
    expect(screen.getByTestId("unread-count").textContent).toBe("1")
  })

  it("detaches the prior session listener and ignores its late events", async () => {
    const firstSocket = createSocket()
    const secondSocket = createSocket()
    window.__notificationTestAuth.socket = firstSocket
    apiRequest.mockImplementation(async (endpoint, { token } = {}) => {
      if (endpoint.startsWith("notifications?page=")) {
        return listResponse([])
      }
      return { unreadCount: token === "token-1" ? 4 : 7 }
    })

    const view = renderNotificationProvider()
    await waitFor(() =>
      expect(screen.getByTestId("unread-count").textContent).toBe("4"),
    )
    const oldHandler = [...firstSocket.handlers.get("notification:created")][0]

    window.__notificationTestAuth = {
      user: { id: "user-2", role: "client" },
      logout: vi.fn(),
      socket: secondSocket,
    }
    localStorage.setItem("budgetflow_token", "token-2")
    view.rerender(
      <NotificationProvider>
        <NotificationConsumer />
      </NotificationProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("unread-count").textContent).toBe("7"),
    )
    expect(firstSocket.handlers.get("notification:created")?.size).toBe(0)
    expect(secondSocket.handlers.get("notification:created")?.size).toBe(1)

    act(() =>
      oldHandler({
        id: "late-old-user-note",
        userId: "user-1",
        isRead: false,
      }),
    )
    expect(screen.getByTestId("unread-count").textContent).toBe("7")
  })

  it("marks one unread notification as read and decrements the count", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return listResponse()
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1/read") {
        return { notification: { ...firstNotification, isRead: true } }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Read notification-1"))

    await waitFor(() => {
      expect(screen.getByTestId("unread-count").textContent).toBe("0")
      expect(screen.getByText("read")).toBeTruthy()
    })
    expect(apiRequest).toHaveBeenCalledWith(
      "notifications/notification-1/read",
      { method: "PATCH", token: "token-1" },
    )
  })

  it("does not request marking an already-read notification as read", async () => {
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint.startsWith("notifications?page=")
        ? listResponse([{ ...firstNotification, isRead: true }])
        : { unreadCount: 0 },
    )

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Read notification-1"))

    expect(apiRequest).not.toHaveBeenCalledWith(
      "notifications/notification-1/read",
      expect.anything(),
    )
  })

  it("preserves unread state when marking one notification fails", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1/read") {
        throw new Error("Read request failed")
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Read notification-1"))

    expect(await screen.findByText("Read request failed")).toBeTruthy()
    expect(screen.getByTestId("unread-count").textContent).toBe("1")
    expect(screen.getByText("unread")).toBeTruthy()
  })

  it("prevents duplicate concurrent requests for one notification", async () => {
    const readRequest = deferred()
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return Promise.resolve(listResponse())
      }
      if (endpoint === "notifications/unread-count") {
        return Promise.resolve({ unreadCount: 1 })
      }
      if (endpoint === "notifications/notification-1/read") {
        return readRequest.promise
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    const button = await screen.findByText("Read notification-1")

    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(
      apiRequest.mock.calls.filter(
        ([endpoint]) => endpoint === "notifications/notification-1/read",
      ),
    ).toHaveLength(1)

    await act(async () => {
      readRequest.resolve({
        notification: { ...firstNotification, isRead: true },
      })
    })
  })

  it("marks all loaded notifications read and sets the count to zero", async () => {
    const secondNotification = {
      ...firstNotification,
      id: "notification-2",
      title: "Another notification",
    }
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return {
          notifications: [firstNotification, secondNotification],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 2 }
      if (endpoint === "notifications/read-all") return { modifiedCount: 2 }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    await screen.findByText("Another notification")
    fireEvent.click(screen.getByText("Read all"))

    await waitFor(() => {
      expect(screen.getByTestId("unread-count").textContent).toBe("0")
      expect(screen.getAllByText("read")).toHaveLength(2)
    })
    expect(apiRequest).toHaveBeenCalledWith("notifications/read-all", {
      method: "PATCH",
      token: "token-1",
    })
  })

  it("does not call read-all when the current state has no unread notifications", async () => {
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint.startsWith("notifications?page=")
        ? listResponse([{ ...firstNotification, isRead: true }])
        : { unreadCount: 0 },
    )

    renderNotificationProvider()
    await screen.findByText("Budget warning from API")
    fireEvent.click(screen.getByText("Read all"))

    expect(apiRequest).not.toHaveBeenCalledWith(
      "notifications/read-all",
      expect.anything(),
    )
  })

  it("keeps notifications unread when read-all fails", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/read-all") {
        throw new Error("Read-all request failed")
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Read all"))

    expect(await screen.findByText("Read-all request failed")).toBeTruthy()
    expect(screen.getByTestId("unread-count").textContent).toBe("1")
    expect(screen.getByText("unread")).toBeTruthy()
  })

  it("prevents duplicate concurrent read-all requests", async () => {
    const readAllRequest = deferred()
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return Promise.resolve(listResponse())
      }
      if (endpoint === "notifications/unread-count") {
        return Promise.resolve({ unreadCount: 1 })
      }
      if (endpoint === "notifications/read-all") return readAllRequest.promise
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    const button = await screen.findByText("Read all")

    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(
      apiRequest.mock.calls.filter(
        ([endpoint]) => endpoint === "notifications/read-all",
      ),
    ).toHaveLength(1)

    await act(async () => {
      readAllRequest.resolve({ modifiedCount: 1 })
    })
  })

  it("deletes an unread notification and decrements the count", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1") {
        return { message: "Notification deleted." }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Delete notification-1"))

    await waitFor(() => {
      expect(screen.queryByText("Budget warning from API")).toBeNull()
      expect(screen.getByTestId("unread-count").textContent).toBe("0")
    })
    expect(apiRequest).toHaveBeenCalledWith("notifications/notification-1", {
      method: "DELETE",
      token: "token-1",
    })
  })

  it("prevents duplicate concurrent deletion requests", async () => {
    const deleteRequest = deferred()
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return Promise.resolve(listResponse())
      }
      if (endpoint === "notifications/unread-count") {
        return Promise.resolve({ unreadCount: 1 })
      }
      if (endpoint === "notifications/notification-1") {
        return deleteRequest.promise
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    const button = await screen.findByText("Delete notification-1")

    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(
      apiRequest.mock.calls.filter(
        ([endpoint]) => endpoint === "notifications/notification-1",
      ),
    ).toHaveLength(1)

    await act(async () => {
      deleteRequest.resolve({ message: "Notification deleted." })
    })
  })

  it("does not decrement the count when deleting an already-read notification", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) {
        return listResponse([{ ...firstNotification, isRead: true }])
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 0 }
      if (endpoint === "notifications/notification-1") {
        return { message: "Notification deleted." }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Delete notification-1"))

    await waitFor(() =>
      expect(screen.queryByText("Budget warning from API")).toBeNull(),
    )
    expect(screen.getByTestId("unread-count").textContent).toBe("0")
  })

  it("refills a shortened page after deletion when later items remain", async () => {
    let listRequestCount = 0
    const remainingNotifications = Array.from({ length: 20 }, (_, index) => ({
      ...firstNotification,
      id: `remaining-${index}`,
      title: `Refill notification ${index + 1}`,
    }))
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint === "notifications?page=1&limit=20") {
        listRequestCount += 1
        if (listRequestCount > 1) {
          return {
            notifications: remainingNotifications,
            pagination: { page: 1, limit: 20, total: 20, totalPages: 1 },
          }
        }
        return {
          notifications: [firstNotification],
          pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
        }
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1") {
        return { message: "Notification deleted." }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Delete notification-1"))

    await waitFor(() => {
      expect(listRequestCount).toBe(2)
    })
    expect(await screen.findByText("Refill notification 20")).toBeTruthy()
    expect(screen.getByTestId("current-page").textContent).toBe("1")
  })

  it("moves back from an emptied final page after deletion", async () => {
    let pageOneRequestCount = 0
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint === "notifications?page=1&limit=20") {
        pageOneRequestCount += 1
        const isRefetch = pageOneRequestCount > 1
        return {
          notifications: [
            {
              ...firstNotification,
              id: isRefetch ? "previous-page" : "page-one",
              title: isRefetch ? "Previous page" : "Page one",
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: isRefetch ? 20 : 21,
            totalPages: isRefetch ? 1 : 2,
          },
        }
      }
      if (endpoint === "notifications?page=2&limit=20") {
        return {
          notifications: [firstNotification],
          pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
        }
      }
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1") {
        return { message: "Notification deleted." }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Load page 2"))
    fireEvent.click(await screen.findByText("Delete notification-1"))

    expect(await screen.findByText("Previous page")).toBeTruthy()
    expect(screen.getByTestId("current-page").textContent).toBe("1")
  })

  it("preserves notifications when deletion fails", async () => {
    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint.startsWith("notifications?page=")) return listResponse()
      if (endpoint === "notifications/unread-count") return { unreadCount: 1 }
      if (endpoint === "notifications/notification-1") {
        throw new Error("Delete request failed")
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    renderNotificationProvider()
    fireEvent.click(await screen.findByText("Delete notification-1"))

    expect(await screen.findByText("Delete request failed")).toBeTruthy()
    expect(screen.getByText("Budget warning from API")).toBeTruthy()
    expect(screen.getByTestId("unread-count").textContent).toBe("1")
  })
})
