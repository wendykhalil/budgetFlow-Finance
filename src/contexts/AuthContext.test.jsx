import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),

  getSocketBaseUrl: () => "http://localhost:5000",
}))

vi.mock("socket.io-client", () => ({ io: vi.fn() }))

import { AuthProvider, useAuth } from "@/contexts/AuthContext"

import { apiRequest } from "@/lib/api"

import { io } from "socket.io-client"

const user = {
  id: "user-1",

  firstName: "Alex",

  lastName: "Martin",

  email: "alex@example.test",

  role: "client",

  currency: "EUR",
}

let socket

function createSocket() {
  const handlers = new Map()

  return {
    handlers,

    on: vi.fn((event, callback) => {
      handlers.set(event, callback)

      return socket
    }),

    off: vi.fn((event, callback) => {
      if (handlers.get(event) === callback) handlers.delete(event)

      return socket
    }),

    connect: vi.fn(() => handlers.get("connect")?.()),

    disconnect: vi.fn(),
  }
}

function AuthConsumer() {
  const {
    user: currentUser,
    socket,
    authError,
    updateCurrency,
    login,
    logout,
  } = useAuth()

  return (
    <div>
      <span data-testid="user-id">{currentUser?.id || "none"}</span>
      <span data-testid="currency">{currentUser?.currency || "none"}</span>
      <span data-testid="auth-error">{authError}</span>
      <span data-testid="shared-socket">{String(Boolean(socket))}</span>
      <button onClick={() => updateCurrency("USD")}>Update</button>
      <button onClick={() => login("alex@example.test", "password")}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()

  localStorage.setItem("budgetflow_token", "test-token")

  socket = createSocket()

  io.mockReturnValue(socket)

  apiRequest.mockResolvedValue({ user })
})

afterEach(() => {
  cleanup()

  vi.clearAllMocks()
})

describe("AuthContext account currency", () => {
  it("updates from authenticated socket events and refreshes profile on reconnect", async () => {
    let restoredUser = { ...user }

    apiRequest.mockImplementation(async (endpoint) => {
      if (endpoint === "auth/me") return { user: restoredUser }

      return { user: { ...restoredUser, currency: "USD" } }
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("EUR"),
    )
    await waitFor(() =>
      expect(screen.getByTestId("shared-socket").textContent).toBe("true"),
    )

    restoredUser = { ...user, currency: "GBP" }

    await act(async () => socket.handlers.get("connect")?.())

    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("GBP"),
    )

    await act(async () => {
      socket.handlers.get("account:currency-updated")?.({ currency: "TND" })
    })

    expect(screen.getByTestId("currency").textContent).toBe("TND")
  })

  it("updates AuthContext only from the successful currency API response", async () => {
    apiRequest.mockImplementation(async (endpoint) =>
      endpoint === "auth/currency"
        ? { user: { ...user, currency: "USD" } }
        : { user },
    )

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("EUR"),
    )

    await act(async () =>
      screen.getByRole("button", { name: "Update" }).click(),
    )

    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("USD"),
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "auth/currency",

      expect.objectContaining({
        method: "PATCH",

        body: { currency: "USD" },

        token: "test-token",
      }),
    )
  })

  it("does not let a stale socket profile refresh overwrite a currency update", async () => {
    let profileRequests = 0
    let resolveSocketRefresh
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint === "auth/me") {
        profileRequests += 1
        if (profileRequests === 1) return Promise.resolve({ user })
        return new Promise((resolve) => {
          resolveSocketRefresh = () => resolve({ user })
        })
      }

      return Promise.resolve({ user: { ...user, currency: "USD" } })
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("EUR"),
    )
    await waitFor(() => expect(resolveSocketRefresh).toBeTypeOf("function"))

    await act(async () =>
      screen.getByRole("button", { name: "Update" }).click(),
    )
    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("USD"),
    )

    await act(async () => resolveSocketRefresh())
    await waitFor(() =>
      expect(screen.getByTestId("currency").textContent).toBe("USD"),
    )
  })

  it("disconnects and stops exposing the authenticated socket after logout", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("shared-socket").textContent).toBe("true"),
    )

    await act(async () => {
      screen.getByRole("button", { name: "Logout" }).click()
    })

    await waitFor(() =>
      expect(screen.getByTestId("shared-socket").textContent).toBe("false"),
    )
    expect(socket.disconnect).toHaveBeenCalledOnce()
  })

  it("creates the authenticated shared socket after login", async () => {
    localStorage.clear()
    apiRequest.mockResolvedValue({ token: "login-token", user })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await act(async () => {
      screen.getByRole("button", { name: "Login" }).click()
    })

    await waitFor(() =>
      expect(screen.getByTestId("shared-socket").textContent).toBe("true"),
    )
    expect(io).toHaveBeenCalledWith(
      "http://localhost:5000",
      expect.objectContaining({ auth: { token: "login-token" } }),
    )
  })

  it("reloads the profile when another tab replaces the stored token", async () => {
    let resolveFirstProfile
    const otherUser = { ...user, id: "user-2", firstName: "Morgan" }
    apiRequest.mockImplementation((endpoint, options) => {
      if (endpoint !== "auth/me") return Promise.resolve({ user: otherUser })
      if (options.token === "test-token") {
        return new Promise((resolve) => {
          resolveFirstProfile = () => resolve({ user })
        })
      }
      return Promise.resolve({ user: otherUser })
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(resolveFirstProfile).toBeTypeOf("function"))

    act(() => {
      localStorage.setItem("budgetflow_token", "token-user-2")
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "budgetflow_token",
          oldValue: "test-token",
          newValue: "token-user-2",
          storageArea: localStorage,
        }),
      )
    })

    await waitFor(() =>
      expect(screen.getByTestId("user-id").textContent).toBe("user-2"),
    )

    await act(async () => resolveFirstProfile())

    expect(screen.getByTestId("user-id").textContent).toBe("user-2")
    expect(apiRequest).toHaveBeenCalledWith("auth/me", {
      token: "token-user-2",
    })
  })

  it("clears the user and disconnects the socket when another tab logs out", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("user-id").textContent).toBe("user-1"),
    )
    await waitFor(() =>
      expect(screen.getByTestId("shared-socket").textContent).toBe("true"),
    )

    act(() => {
      localStorage.removeItem("budgetflow_token")
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "budgetflow_token",
          oldValue: "test-token",
          newValue: null,
          storageArea: localStorage,
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("none")
      expect(screen.getByTestId("shared-socket").textContent).toBe("false")
    })
    expect(socket.disconnect).toHaveBeenCalled()
  })

  it("replaces session sockets without retaining listeners across token changes", async () => {
    const sockets = []
    io.mockImplementation(() => {
      const nextSocket = createSocket()
      sockets.push(nextSocket)
      return nextSocket
    })
    apiRequest.mockImplementation((endpoint, options) => {
      if (endpoint !== "auth/me") return Promise.resolve({ user })
      if (options.token === "token-user-2") {
        return Promise.resolve({
          user: { ...user, id: "user-2", firstName: "Morgan" },
        })
      }
      if (options.token === "token-user-3") {
        return Promise.resolve({
          user: { ...user, id: "user-3", firstName: "Jamie" },
        })
      }
      return Promise.resolve({ user })
    })

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(sockets).toHaveLength(1))

    const replaceToken = (oldValue, newValue) => {
      localStorage.setItem("budgetflow_token", newValue)
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "budgetflow_token",
          oldValue,
          newValue,
          storageArea: localStorage,
        }),
      )
    }

    act(() => replaceToken("test-token", "token-user-2"))
    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("user-2")
      expect(sockets).toHaveLength(2)
    })
    expect(sockets[0].disconnect).toHaveBeenCalledOnce()
    expect(sockets[0].handlers.size).toBe(0)

    act(() => replaceToken("token-user-2", "token-user-3"))
    await waitFor(() => {
      expect(screen.getByTestId("user-id").textContent).toBe("user-3")
      expect(sockets).toHaveLength(3)
    })
    expect(sockets[1].disconnect).toHaveBeenCalledOnce()
    expect(sockets[1].handlers.size).toBe(0)
    expect(sockets[2].handlers.get("connect")).toBeTypeOf("function")
    expect(sockets[2].handlers.get("account:currency-updated")).toBeTypeOf(
      "function",
    )
    expect(sockets[2].on).toHaveBeenCalledTimes(2)
  })
})
