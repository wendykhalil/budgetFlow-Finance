import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { AdminReports } from "./Reports"

const authSession = vi.hoisted(() => ({
  current: {
    user: { id: "admin-1", role: "admin" },

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
      totalAmount: 600,
      income: 0,
      expense: 600,
      transactionCount: 3,
    },

    {
      category: "Salary",
      totalAmount: 1000,
      income: 1000,
      expense: 0,
      transactionCount: 1,
    },
  ],

  summary: {
    totalTransactions: 4,

    totalAmount: 1600,

    totalIncome: 1000,

    totalExpense: 600,
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

      totalAmount: 150,

      income: 100,

      expense: 50,

      transactionCount: 2,
    },

    {
      userId: "user-usd",

      firstName: "Sam",

      lastName: "Taylor",

      email: "sam@example.test",

      currency: "USD",

      totalAmount: 900,

      income: 700,

      expense: 200,

      transactionCount: 3,
    },
  ],

  summary: {
    totalUsers: 2,

    totalTransactions: 5,

    totalAmount: 1050,

    totalIncome: 800,

    totalExpense: 250,
  },
}

function renderPage() {
  return render(<AdminReports />)
}

function resolveBothReports(
  category = categoryResponse,
  spending = spendingResponse,
) {
  apiRequest.mockImplementation((endpoint) =>
    Promise.resolve(
      endpoint.includes("transactions-by-category") ? category : spending,
    ),
  )
}

function deferred() {
  let resolve

  const promise = new Promise((res) => {
    resolve = res
  })

  return { promise, resolve }
}

beforeEach(() => {
  authSession.current = {
    user: { id: "admin-1", role: "admin" },

    token: "admin-token-a",
  }

  apiRequest.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("AdminReports", () => {
  it("loads both authenticated live report endpoints and displays completed counts", async () => {
    resolveBothReports()

    renderPage()

    await screen.findAllByText("eva@example.test")

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/transactions-by-category",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/user-spending?limit=500",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(screen.getByText("Completed transactions by category")).toBeTruthy()

    expect(
      screen.getAllByText("4", { selector: "text" }).length,
    ).toBeGreaterThan(0)

    expect(screen.getByText("Transactions: 3")).toBeTruthy()

    expect(screen.queryByText("€3.84M")).toBeNull()
  })

  it("shows user amounts and subtotals separately for each returned currency", async () => {
    resolveBothReports()

    renderPage()

    await screen.findAllByText("eva@example.test")

    expect(
      screen.getByRole("heading", { name: "Spending by user · EUR" }),
    ).toBeTruthy()

    expect(
      screen.getByRole("heading", { name: "Spending by user · USD" }),
    ).toBeTruthy()

    expect(screen.getByText("Returned users subtotal · EUR")).toBeTruthy()

    expect(screen.getByText("Returned users subtotal · USD")).toBeTruthy()

    expect(screen.getAllByText(/€50\.00/).length).toBeGreaterThan(0)

    expect(screen.getAllByText(/\$200\.00/).length).toBeGreaterThan(0)

    expect(screen.queryByText(/Global total/i)).toBeNull()
  })

  it("shows independent loading and empty states", async () => {
    const category = deferred()

    const spending = deferred()

    apiRequest.mockImplementation((endpoint) =>
      endpoint.includes("transactions-by-category")
        ? category.promise
        : spending.promise,
    )

    const { rerender } = renderPage()

    expect(screen.getAllByText("Loading report…").length).toBe(3)

    category.resolve({ data: [], summary: { totalTransactions: 0 } })

    spending.resolve({
      data: [],
      summary: { totalUsers: 0, totalTransactions: 0 },
    })

    rerender(<AdminReports />)

    await screen.findAllByText(
      "No completed transactions were found for this period.",
    )

    expect(
      screen.getAllByText(
        "No completed user spending was found for this period.",
      ).length,
    ).toBeGreaterThan(0)
  })

  it("shows API errors without fake fallback data while keeping the other report available", async () => {
    apiRequest.mockImplementation((endpoint) =>
      endpoint.includes("transactions-by-category")
        ? Promise.reject(new Error("Category report unavailable"))
        : Promise.resolve(spendingResponse),
    )

    renderPage()

    expect(
      (await screen.findAllByText("Category report unavailable")).length,
    ).toBeGreaterThan(0)

    expect(
      (await screen.findAllByText("eva@example.test")).length,
    ).toBeGreaterThan(0)

    expect(screen.queryByText("€3.84M")).toBeNull()
  })

  it("shows explicit errors for incomplete and unsupported response values", async () => {
    apiRequest.mockImplementation((endpoint) =>
      endpoint.includes("transactions-by-category")
        ? Promise.resolve({ data: [], summary: {} })
        : Promise.resolve({
            ...spendingResponse,

            data: [{ ...spendingResponse.data[0], currency: "XYZ" }],
          }),
    )

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

    expect(screen.queryByText("Name unavailable")).toBeNull()
  })

  it("aborts and ignores responses from the previous authenticated session", async () => {
    const pending = []

    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()

      pending.push({ endpoint, options, ...request })

      return request.promise
    })

    const { rerender } = renderPage()

    await waitFor(() => expect(pending).toHaveLength(2))

    authSession.current = {
      user: { id: "admin-2", role: "admin" },

      token: "admin-token-b",
    }

    rerender(<AdminReports />)

    await waitFor(() => expect(pending).toHaveLength(4))

    expect(pending[0].options.signal.aborted).toBe(true)

    expect(pending[1].options.signal.aborted).toBe(true)

    pending[0].resolve(categoryResponse)

    pending[1].resolve({
      ...spendingResponse,

      data: [{ ...spendingResponse.data[0], email: "stale@example.test" }],

      summary: { totalUsers: 1, totalTransactions: 2 },
    })

    pending[2].resolve(categoryResponse)

    pending[3].resolve(spendingResponse)

    expect(
      (await screen.findAllByText("eva@example.test")).length,
    ).toBeGreaterThan(0)

    expect(screen.queryByText("stale@example.test")).toBeNull()

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/user-spending?limit=500",

      { token: "admin-token-b", signal: expect.any(AbortSignal) },
    )
  })

  it("ignores pending report responses after logout", async () => {
    const pending = []
    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()
      pending.push({ endpoint, options, ...request })
      return request.promise
    })

    const { rerender } = renderPage()
    await waitFor(() => expect(pending).toHaveLength(2))

    authSession.current = { user: null, token: null }
    rerender(<AdminReports />)

    expect(
      (
        await screen.findAllByText(
          "An administrator session is required to load reports.",
        )
      ).length,
    ).toBeGreaterThan(0)
    expect(pending[0].options.signal.aborted).toBe(true)
    expect(pending[1].options.signal.aborted).toBe(true)

    pending[0].resolve(categoryResponse)
    pending[1].resolve(spendingResponse)

    await waitFor(() =>
      expect(screen.queryByText("eva@example.test")).toBeNull(),
    )
  })

  it("ignores earlier requests after a newer date-filtered request starts", async () => {
    const pending = []
    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()
      pending.push({ endpoint, options, ...request })
      return request.promise
    })

    renderPage()
    await waitFor(() => expect(pending).toHaveLength(2))

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-10-01" },
    })
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-31" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Apply date range" }))

    await waitFor(() => expect(pending).toHaveLength(4))
    expect(pending[0].options.signal.aborted).toBe(true)
    expect(pending[1].options.signal.aborted).toBe(true)

    pending[0].resolve(categoryResponse)
    pending[1].resolve({
      ...spendingResponse,
      data: [{ ...spendingResponse.data[0], email: "stale@example.test" }],
      summary: { totalUsers: 1, totalTransactions: 2 },
    })
    pending[2].resolve(categoryResponse)
    pending[3].resolve(spendingResponse)

    expect(
      (await screen.findAllByText("eva@example.test")).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("stale@example.test")).toBeNull()
  })

  it("reloads both endpoints with backend-supported date filters", async () => {
    resolveBothReports()

    renderPage()

    await screen.findAllByText("eva@example.test")

    apiRequest.mockClear()

    resolveBothReports()

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-10-01" },
    })

    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-31" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Apply date range" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/transactions-by-category?startDate=2026-10-01&endDate=2026-10-31",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "admin/reports/user-spending?startDate=2026-10-01&endDate=2026-10-31&limit=500",

      { token: "admin-token-a", signal: expect.any(AbortSignal) },
    )
  })

  it("does not fetch an invalid date range", async () => {
    resolveBothReports()

    renderPage()

    await screen.findAllByText("eva@example.test")

    apiRequest.mockClear()

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-11-01" },
    })

    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-01" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Apply date range" }))

    expect(
      screen.getByText("Start date must be on or before end date."),
    ).toBeTruthy()

    expect(apiRequest).not.toHaveBeenCalled()
  })
})
