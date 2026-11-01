import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useState } from "react"

import { act, cleanup, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: window.__budgetTestUser }),
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),

  getSocketBaseUrl: () => "http://localhost:5000",
}))

vi.mock("@/contexts/TransactionContext", async () => {
  const { createContext, useContext } = await import("react")
  const TransactionTestContext = createContext(null)
  window.__budgetTransactionTestContext = TransactionTestContext

  return {
    useTransactions: () => useContext(TransactionTestContext),
  }
})

vi.mock("socket.io-client", () => ({ io: vi.fn() }))

import { apiRequest } from "@/lib/api"

import { io } from "socket.io-client"

import { BudgetProvider, useBudgets } from "@/contexts/BudgetContext"

let socket

function makeSocket() {
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

    connect: vi.fn(),

    disconnect: vi.fn(),

    emitFromServer(event, payload) {
      handlers.get(event)?.(payload)
    },
  }
}

function Consumer() {
  const {
    budgets,

    loading,

    error,

    refreshBudgets,

    createBudget,

    updateBudget,

    deleteBudget,
  } = useBudgets()

  return (
    <div>
      <span>{loading ? "Loading" : "Loaded"}</span>
      {error && <span role="alert">{error}</span>}
      {budgets.map((budget) => (
        <span key={budget.id}>
          {budget.name}:{budget.spending?.spent ?? "No spending"}
        </span>
      ))}
      <button
        onClick={() =>
          createBudget({
            name: "New budget",

            limit: 50,

            categoryId: "category-2",

            period: "monthly",

            startDate: "2026-11-01",
          })
        }
      >
        Create
      </button>
      <button
        onClick={() => updateBudget("budget-1", { name: "Updated budget" })}
      >
        Update
      </button>
      <button onClick={() => deleteBudget("budget-1")}>Delete</button>
      <button onClick={() => refreshBudgets()}>Refresh</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <TransactionSource>
      <BudgetProvider>
        <Consumer />
      </BudgetProvider>
    </TransactionSource>,
  )
}

function TransactionSource({ children }) {
  const [transactions, setTransactions] = useState(
    () => window.__initialBudgetTransactions || [],
  )

  window.__setBudgetTransactions = setTransactions

  const TransactionTestContext = window.__budgetTransactionTestContext
  return (
    <TransactionTestContext.Provider value={{ transactions, loading: false }}>
      {children}
    </TransactionTestContext.Provider>
  )
}

function setTransactions(transactions) {
  act(() => window.__setBudgetTransactions(transactions))
}

const listedBudget = {
  id: "budget-1",

  name: "Food",

  limit: 100,

  startDate: "2026-11-01",

  period: "monthly",

  categoryId: { id: "category-1", name: "Food", type: "expense" },
}

const spending = {
  spent: 85,

  limit: 100,

  remaining: 15,

  percentUsed: 85,

  status: "warning",

  periodStart: "2026-11-01",

  periodEnd: "2026-11-30",
}

beforeEach(() => {
  window.__budgetTestUser = { id: "user-1", role: "client" }

  window.__initialBudgetTransactions = []

  localStorage.setItem("budgetflow_token", "token-1")

  socket = makeSocket()

  io.mockReturnValue(socket)

  apiRequest.mockReset()

  apiRequest.mockImplementation((endpoint, options = {}) => {
    if (endpoint.endsWith("/spent")) {
      if (endpoint === "budgets/budget-2/spent") {
        return Promise.resolve({ ...spending, spent: 0, status: "healthy" })
      }

      return Promise.resolve(
        window.__budgetSpendingResponse
          ? window.__budgetSpendingResponse(endpoint)
          : spending,
      )
    }

    if (endpoint === "budgets" && !options.method) {
      return Promise.resolve({ budgets: [listedBudget] })
    }

    if (endpoint === "budgets" && options.method === "POST") {
      return Promise.resolve({
        budget: { ...listedBudget, id: "budget-2", name: "New budget" },
      })
    }

    if (endpoint === "budgets/budget-1" && options.method === "PATCH") {
      return Promise.resolve({
        budget: { ...listedBudget, name: "Updated budget" },
      })
    }

    if (endpoint === "budgets/budget-1" && options.method === "DELETE") {
      return Promise.resolve({ message: "Budget deleted." })
    }

    return Promise.reject(new Error(`Unexpected request: ${endpoint}`))
  })
})

afterEach(() => {
  cleanup()

  localStorage.clear()

  delete window.__setBudgetTransactions

  delete window.__initialBudgetTransactions

  delete window.__budgetSpendingResponse

  vi.clearAllMocks()
})

describe("BudgetContext", () => {
  it("loads budgets and their spending, then applies CRUD actions once by ID", async () => {
    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledWith(
      "budgets",

      expect.objectContaining({ token: "token-1" }),
    )

    await act(async () => screen.getByText("Create").click())

    expect(await screen.findByText("New budget:0")).toBeTruthy()

    await act(async () => {
      socket.emitFromServer("budget:created", {
        budget: { ...listedBudget, id: "budget-2", name: "New budget" },
      })
    })

    await waitFor(() => {
      expect(screen.getAllByText(/New budget:/)).toHaveLength(1)
    })

    await act(async () => screen.getByText("Update").click())

    expect(await screen.findByText("Updated budget:85")).toBeTruthy()

    await act(async () => screen.getByText("Delete").click())

    await waitFor(() =>
      expect(screen.queryByText(/Updated budget:/)).toBeNull(),
    )
  })

  it("re-fetches from REST on reconnect and removes deleted budgets from socket events", async () => {
    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    const requestCount = apiRequest.mock.calls.filter(
      ([endpoint]) => endpoint === "budgets",
    ).length

    act(() => socket.emitFromServer("connect"))

    act(() => socket.emitFromServer("connect"))

    await waitFor(() => {
      expect(
        apiRequest.mock.calls.filter(([endpoint]) => endpoint === "budgets")
          .length,
      ).toBeGreaterThan(requestCount)
    })

    act(() => socket.emitFromServer("budget:deleted", { budgetId: "budget-1" }))

    await waitFor(() => expect(screen.queryByText("Food:85")).toBeNull())

    expect(socket.handlers.has("budget:created")).toBe(true)

    expect(socket.handlers.has("budget:updated")).toBe(true)

    expect(socket.handlers.has("budget:deleted")).toBe(true)
  })

  it("reports API failures instead of treating invalid responses as empty budgets", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Budget service unavailable."))

    renderProvider()

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Budget service unavailable.",
    )

    expect(screen.getByText("Loaded")).toBeTruthy()
  })

  it("refreshes spending for completed expense creation but not pending expenses", async () => {
    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    const spentRequestCount = () =>
      apiRequest.mock.calls.filter(([endpoint]) => endpoint.endsWith("/spent"))
        .length

    const initialRequestCount = spentRequestCount()
    setTransactions([
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 12,
        type: "expense",
        status: "completed",
      },
    ])

    await waitFor(() =>
      expect(spentRequestCount()).toBe(initialRequestCount + 1),
    )

    const afterCompletedExpense = spentRequestCount()
    setTransactions([
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 12,
        type: "expense",
        status: "completed",
      },
      {
        id: "pending-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 25,
        type: "expense",
        status: "pending",
      },
    ])

    await act(async () => Promise.resolve())
    expect(spentRequestCount()).toBe(afterCompletedExpense)
  })

  it("refreshes spending for amount, category, date, status, type, and delete changes", async () => {
    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    const spentRequestCount = () =>
      apiRequest.mock.calls.filter(([endpoint]) => endpoint.endsWith("/spent"))
        .length
    const initialRequestCount = spentRequestCount()
    let transactions = [
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 12,
        type: "expense",
        status: "completed",
      },
    ]

    setTransactions(transactions)
    await waitFor(() =>
      expect(spentRequestCount()).toBe(initialRequestCount + 1),
    )

    const expectOneRefresh = async (change) => {
      const before = spentRequestCount()
      transactions = change(transactions)
      setTransactions(transactions)
      await waitFor(() => expect(spentRequestCount()).toBe(before + 1))
    }

    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, amount: 18 })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, categoryId: "category-2" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, categoryId: "category-1" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, date: "2026-12-01" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, date: "2026-11-12" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, status: "pending" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, status: "completed" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, type: "income" })),
    )
    await expectOneRefresh((current) =>
      current.map((item) => ({ ...item, type: "expense" })),
    )
    await expectOneRefresh(() => [])
  })

  it("does not fetch spending when the authenticated user has no budgets", async () => {
    apiRequest.mockImplementation((endpoint) => {
      if (endpoint === "budgets") return Promise.resolve({ budgets: [] })
      return Promise.reject(new Error(`Unexpected request: ${endpoint}`))
    })

    renderProvider()

    await waitFor(() => expect(screen.getByText("Loaded")).toBeTruthy())
    setTransactions([
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 12,
        type: "expense",
        status: "completed",
      },
    ])

    await act(async () => Promise.resolve())
    expect(
      apiRequest.mock.calls.filter(([endpoint]) => endpoint.endsWith("/spent")),
    ).toHaveLength(0)
  })

  it("coalesces rapid changes and discards stale spending responses", async () => {
    let resolveFirstSpending
    let spendingCalls = 0
    const staleResponse = new Promise((resolve) => {
      resolveFirstSpending = resolve
    })
    window.__budgetSpendingResponse = () => {
      spendingCalls += 1
      return spendingCalls === 1
        ? Promise.resolve(spending)
        : spendingCalls === 2
          ? staleResponse
          : Promise.resolve({
              ...spending,
              spent: 90,
              remaining: 10,
              percentUsed: 90,
              status: "warning",
            })
    }

    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    setTransactions([
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 12,
        type: "expense",
        status: "completed",
      },
    ])

    await waitFor(() => expect(spendingCalls).toBe(2))

    setTransactions([
      {
        id: "expense-1",
        categoryId: "category-1",
        date: "2026-11-12",
        amount: 20,
        type: "expense",
        status: "completed",
      },
    ])

    resolveFirstSpending(spending)

    await waitFor(() => expect(spendingCalls).toBe(3))
    expect(await screen.findByText("Food:90")).toBeTruthy()
  })

  it("does not refresh twice for an unchanged REST/socket transaction update", async () => {
    renderProvider()

    expect(await screen.findByText("Food:85")).toBeTruthy()

    const transaction = {
      id: "expense-1",
      categoryId: "category-1",
      date: "2026-11-12",
      amount: 12,
      type: "expense",
      status: "completed",
    }
    const initialRequestCount = apiRequest.mock.calls.filter(([endpoint]) =>
      endpoint.endsWith("/spent"),
    ).length

    setTransactions([transaction])
    await waitFor(() =>
      expect(
        apiRequest.mock.calls.filter(([endpoint]) =>
          endpoint.endsWith("/spent"),
        ),
      ).toHaveLength(initialRequestCount + 1),
    )

    const requestCountAfterRestUpdate = apiRequest.mock.calls.filter(
      ([endpoint]) => endpoint.endsWith("/spent"),
    ).length
    setTransactions([{ ...transaction }])
    await act(async () => Promise.resolve())

    expect(
      apiRequest.mock.calls.filter(([endpoint]) => endpoint.endsWith("/spent")),
    ).toHaveLength(requestCountAfterRestUpdate)
  })
})
