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
  const { user: currentUser, updateCurrency } = useAuth()

  return (
    <div>
      <span data-testid="currency">{currentUser?.currency || "none"}</span>
      <button onClick={() => updateCurrency("USD")}>Update</button>
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
})
