import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

import { getLocalDateString } from "@/utils/calendarDates"

import { formatCurrency } from "@/utils/formatters"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: window.__dashboardUser }),
}))

vi.mock("@/contexts/TransactionContext", () => ({
  useTransactions: () => window.__dashboardTransactions,
}))

vi.mock("@/contexts/BudgetContext", () => ({
  useBudgets: () => window.__dashboardBudgets,
}))

import ClientDashboard from "@/pages/client/Dashboard"

const currentMonth = getLocalDateString().slice(0, 7)

function makeBudget({
  id,

  name = id,

  percentUsed = 50,

  status = "healthy",

  startDate = `${currentMonth}-01`,

  createdAt = "2026-01-01T00:00:00.000Z",

  category = name,

  spent = 50,

  limit = 100,

  remaining = limit - spent,
}) {
  return {
    id,

    name,

    startDate,

    createdAt,

    categoryId: category ? { id: `category-${id}`, name: category } : null,

    spending: { spent, limit, remaining, percentUsed, status },
  }
}

function CurrentPath() {
  const location = useLocation()

  return <span data-testid="current-path">{location.pathname}</span>
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/client/dashboard"]}>
      <Routes>
        <Route path="/client/dashboard" element={<ClientDashboard />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.__dashboardUser = {
    id: "user-1",

    firstName: "Alex",

    currency: "EUR",
  }

  window.__dashboardTransactions = {
    transactions: [],

    loading: false,

    error: "",

    refreshTransactions: vi.fn(),
  }

  window.__dashboardBudgets = {
    budgets: [],

    loading: false,

    error: "",

    refreshBudgets: vi.fn(),
  }
})

afterEach(() => {
  cleanup()

  delete window.__dashboardUser

  delete window.__dashboardTransactions

  delete window.__dashboardBudgets

  vi.clearAllMocks()
})

describe("ClientDashboard budget summary", () => {
  it("shows the top three current-month budgets by backend usage without mutating context data", () => {
    const budgets = [
      makeBudget({ id: "low", name: "Low", percentUsed: 20 }),

      makeBudget({ id: "high", name: "High", percentUsed: 95 }),

      makeBudget({ id: "middle", name: "Middle", percentUsed: 70 }),

      makeBudget({ id: "fourth", name: "Fourth", percentUsed: 40 }),

      makeBudget({
        id: "historical",

        name: "Historical",

        percentUsed: 100,

        startDate: "2025-12-01",
      }),
    ]

    const originalOrder = budgets.map((budget) => budget.id)

    window.__dashboardBudgets.budgets = budgets

    renderDashboard()

    expect(
      screen
        .getAllByRole("progressbar")
        .map((bar) => bar.getAttribute("aria-label")),
    ).toEqual([
      "High budget usage",

      "Middle budget usage",

      "Fourth budget usage",
    ])

    expect(screen.queryByText("Historical")).toBeNull()

    expect(screen.getAllByRole("progressbar")).toHaveLength(3)

    expect(budgets.map((budget) => budget.id)).toEqual(originalOrder)
  })

  it("breaks equal usage ties by most recently updated and then stable ID", () => {
    window.__dashboardBudgets.budgets = [
      makeBudget({
        id: "b",

        name: "B",

        percentUsed: 85,

        createdAt: "2026-01-01T00:00:00.000Z",
      }),

      makeBudget({
        id: "a",

        name: "A",

        percentUsed: 85,

        createdAt: "2026-01-01T00:00:00.000Z",
      }),

      makeBudget({
        id: "newest",

        name: "Newest",

        percentUsed: 85,

        createdAt: "2026-03-01T00:00:00.000Z",
      }),
    ]

    renderDashboard()

    expect(
      screen
        .getAllByRole("progressbar")
        .map((bar) => bar.getAttribute("aria-label")),
    ).toEqual([
      "Newest budget usage",

      "A budget usage",

      "B budget usage",
    ])
  })

  it.each([1, 2])("renders %i current-month budget(s)", (count) => {
    window.__dashboardBudgets.budgets = [
      makeBudget({ id: "one", name: "One", percentUsed: 75 }),

      makeBudget({ id: "two", name: "Two", percentUsed: 60 }),
    ].slice(0, count)

    renderDashboard()

    expect(screen.getAllByRole("progressbar")).toHaveLength(count)
  })

  it("shows an empty state and navigates to budget creation", () => {
    window.__dashboardBudgets.budgets = [
      makeBudget({
        id: "historical",

        name: "Historical",

        startDate: "2025-12-01",
      }),
    ]

    renderDashboard()

    expect(screen.getByText("No budgets for this month yet.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Create a budget" }))

    expect(screen.getByTestId("current-path").textContent).toBe(
      "/client/budgets/new",
    )
  })

  it("shows a loading state while BudgetContext is loading", () => {
    window.__dashboardBudgets.loading = true

    renderDashboard()

    expect(screen.getByRole("status").textContent).toBe("Loading budgets...")
  })

  it("shows the BudgetContext error and retries through its refresh function", () => {
    window.__dashboardBudgets.error = "Budget service unavailable."

    renderDashboard()

    expect(screen.getByRole("alert").textContent).toBe(
      "Budget service unavailable.",
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(window.__dashboardBudgets.refreshBudgets).toHaveBeenCalledOnce()
  })

  it("uses backend spending fields, account currency, archived category fallback, and capped progress", () => {
    window.__dashboardUser.currency = "TND"

    window.__dashboardBudgets.budgets = [
      makeBudget({
        id: "archived",

        name: "Archived plan",

        category: null,

        spent: 125.5,

        limit: 100,

        remaining: 0,

        percentUsed: 125.5,

        status: "exceeded",
      }),
    ]

    renderDashboard()

    expect(screen.getByText("Archived category")).toBeTruthy()

    const budgetCard = screen.getByText("Archived category").closest("section")
    const cardText = budgetCard.textContent.replace(/\s+/g, " ")
    expect(cardText).toContain(
      formatCurrency(125.5, "TND").replace(/\s+/g, " "),
    )
    expect(cardText).toContain(formatCurrency(100, "TND").replace(/\s+/g, " "))

    expect(screen.getByText("125.5% used")).toBeTruthy()

    expect(cardText).toContain(
      `${formatCurrency(0, "TND").replace(/\s+/g, " ")} remaining`,
    )

    expect(screen.getByText("exceeded")).toBeTruthy()

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    )

    expect(
      screen.getByRole("progressbar").firstElementChild.firstElementChild.style
        .width,
    ).toBe("100%")
  })
})
