import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@testing-library/react"

import { AdminDashboard } from "./Dashboard"
import { formatUserCurrency } from "@/utils/formatters"

const authSession = vi.hoisted(() => ({
  current: {
    user: { id: "admin-a", role: "admin" },

    token: "admin-token-a",
  },
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authSession.current,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api"

const categoryResponse = {
  data: [
    {
      category: "Food",
      transactionCount: 4,
      totalAmount: 999999,
      income: 0,
      expense: 999999,
    },

    {
      category: "Salary",
      transactionCount: 3,
      totalAmount: 888888,
      income: 888888,
      expense: 0,
    },
  ],

  summary: {
    totalTransactions: 7,

    totalAmount: 1888887,

    totalIncome: 888888,

    totalExpense: 999999,
  },
}

const spendingResponse = {
  data: [
    {
      userId: "user-eur",

      firstName: "Eva",

      lastName: "Martin",

      email: "eva@example.test",

      currency: "EUR",

      totalAmount: 80,

      income: 30,

      expense: 50,

      transactionCount: 2,
    },

    {
      userId: "user-usd",

      firstName: "Sam",

      lastName: "Taylor",

      email: "sam@example.test",

      currency: "USD",

      totalAmount: 600,

      income: 400,

      expense: 200,

      transactionCount: 2,
    },
  ],

  summary: {
    totalUsers: 2,

    totalTransactions: 4,

    totalAmount: 680,

    totalIncome: 430,

    totalExpense: 250,
  },
}

function listResponse(total) {
  return {
    data: [{ id: "one-row-only" }],

    pagination: { page: 1, limit: 1, total, pages: total },
  }
}

function responseFor(endpoint) {
  if (endpoint.startsWith("admin/users")) {
    if (endpoint.includes("status=active")) return listResponse(30)

    if (endpoint.includes("status=pending")) return listResponse(7)

    if (endpoint.includes("status=suspended")) return listResponse(5)

    return listResponse(42)
  }

  if (endpoint.startsWith("admin/transactions")) {
    return listResponse(845)
  }

  if (endpoint.includes("transactions-by-category")) {
    return categoryResponse
  }

  return spendingResponse
}

function deferred() {
  let resolve

  const promise = new Promise((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function renderPage() {
  return render(<AdminDashboard />)
}

function resolveAllWith(responseForEndpoint = responseFor) {
  apiRequest.mockImplementation((endpoint) =>
    Promise.resolve().then(() => responseForEndpoint(endpoint)),
  )
}

beforeEach(() => {
  authSession.current = {
    user: { id: "admin-a", role: "admin" },

    token: "admin-token-a",
  }

  apiRequest.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("AdminDashboard", () => {
  it("shows loading state while the real admin APIs are pending", () => {
    apiRequest.mockImplementation(() => new Promise(() => {}))

    renderPage()

    expect(screen.getAllByText("Loading dashboard data…").length).toBe(3)

    expect(screen.getByText("Total users")).toBeTruthy()

    expect(screen.getAllByText("Loading…").length).toBeGreaterThan(0)
  })

  it("uses exact pagination totals and only supported report metrics", async () => {
    resolveAllWith()

    renderPage()

    await screen.findAllByText("eva@example.test")

    expect(screen.getAllByText("42").length).toBeGreaterThan(0)

    expect(screen.getAllByText("30").length).toBeGreaterThan(0)

    expect(screen.getAllByText("845").length).toBeGreaterThan(0)

    expect(screen.getAllByText("7").length).toBeGreaterThan(0)

    expect(screen.getByText("Completed transactions by category")).toBeTruthy()

    expect(screen.getAllByText("Active users").length).toBeGreaterThan(0)

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/users?page=1&limit=1",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/transactions?page=1&limit=1",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/transactions-by-category",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/user-spending?limit=500",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/users?page=1&limit=1&status=active",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )
  })

  it("does not display monetary totals from the category report or combine currencies", async () => {
    resolveAllWith()

    renderPage()

    await screen.findAllByText("eva@example.test")

    expect(screen.getByText("EUR expenses among returned users")).toBeTruthy()

    expect(screen.getByText("USD expenses among returned users")).toBeTruthy()

    expect(screen.getByText(formatUserCurrency(50, "EUR"))).toBeTruthy()
    expect(screen.getByText(formatUserCurrency(200, "USD"))).toBeTruthy()

    expect(screen.queryByText("€999,999.00")).toBeNull()

    expect(screen.queryByText("Global spending total")).toBeNull()

    expect(screen.getByText(/not whole-database totals/i)).toBeTruthy()
  })

  it("shows empty states for valid APIs with no records", async () => {
    resolveAllWith((endpoint) => {
      if (endpoint.startsWith("admin/users")) return listResponse(0)

      if (endpoint.startsWith("admin/transactions")) return listResponse(0)

      if (endpoint.includes("transactions-by-category")) {
        return { data: [], summary: { totalTransactions: 0 } }
      }

      return {
        data: [],

        summary: { totalUsers: 0, totalTransactions: 0 },
      }
    })

    renderPage()

    expect(
      await screen.findByText("No completed category activity is available."),
    ).toBeTruthy()

    expect(screen.getByText("No users are registered.")).toBeTruthy()

    expect(
      screen.getByText("No completed user spending is available."),
    ).toBeTruthy()
  })

  it("surfaces API errors without using mock fallback data", async () => {
    resolveAllWith((endpoint) => {
      if (endpoint.startsWith("admin/transactions")) {
        throw new Error("Transaction count unavailable")
      }

      return responseFor(endpoint)
    })

    renderPage()

    expect(
      (await screen.findAllByText("Transaction count unavailable")).length,
    ).toBeGreaterThan(0)

    expect(
      screen.getByText("All users from API pagination metadata"),
    ).toBeTruthy()

    expect(screen.queryByText("Illustrative chart data")).toBeNull()

    expect(screen.queryByText("Unavailable")).toBeTruthy()
  })

  it("rejects malformed or currency-ambiguous report rows", async () => {
    resolveAllWith((endpoint) => {
      if (endpoint.includes("transactions-by-category")) {
        return { data: [], summary: {} }
      }

      if (endpoint.includes("user-spending")) {
        return {
          ...spendingResponse,

          data: [{ ...spendingResponse.data[0], currency: "XYZ" }],

          summary: { totalUsers: 1, totalTransactions: 2 },
        }
      }

      return responseFor(endpoint)
    })

    renderPage()

    expect(
      (
        await screen.findAllByText(
          "The category report returned an unexpected response.",
        )
      ).length,
    ).toBeTruthy()

    expect(
      (
        await screen.findAllByText(
          "The user spending report returned incomplete or unexpected data.",
        )
      ).length,
    ).toBeTruthy()

    expect(screen.queryByText("EUR expenses among returned users")).toBeNull()
  })

  it("aborts and ignores responses from the previous authenticated user", async () => {
    const pending = []

    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()

      pending.push({ endpoint, options, ...request })

      return request.promise
    })

    const { rerender } = renderPage()

    await waitFor(() => expect(pending).toHaveLength(7))

    authSession.current = {
      user: { id: "admin-b", role: "admin" },

      token: "admin-token-b",
    }

    rerender(<AdminDashboard />)

    await waitFor(() => expect(pending).toHaveLength(14))

    expect(
      pending.slice(0, 7).every(({ options }) => options.signal.aborted),
    ).toBe(true)

    pending.slice(0, 7).forEach(({ endpoint, resolve }) => {
      resolve(
        endpoint.startsWith("admin/users") ||
          endpoint.startsWith("admin/transactions")
          ? listResponse(999)
          : endpoint.includes("transactions-by-category")
            ? categoryResponse
            : spendingResponse,
      )
    })

    pending.slice(7).forEach(({ endpoint, resolve }) => {
      resolve(responseFor(endpoint))
    })

    expect(
      (await screen.findAllByText("eva@example.test")).length,
    ).toBeGreaterThan(0)

    expect(screen.getAllByText("42").length).toBeGreaterThan(0)

    expect(screen.queryByText("999")).toBeNull()

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/user-spending?limit=500",

      { token: "admin-token-b", signal: expect.any(AbortSignal) },
    )
  })

  it("aborts pending requests and shows no previous data after logout", async () => {
    const pending = []

    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()

      pending.push({ endpoint, options, ...request })

      return request.promise
    })

    const { rerender } = renderPage()

    await waitFor(() => expect(pending).toHaveLength(7))

    authSession.current = { user: null, token: null }

    rerender(<AdminDashboard />)

    expect(
      (
        await screen.findAllByText(
          "An administrator session is required to load dashboard data.",
        )
      ).length,
    ).toBeGreaterThan(0)

    expect(pending.every(({ options }) => options.signal.aborted)).toBe(true)

    pending.forEach(({ endpoint, resolve }) => {
      resolve(responseFor(endpoint))
    })

    expect(screen.queryByText("eva@example.test")).toBeNull()
  })
})
