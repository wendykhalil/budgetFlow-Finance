import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: window.__budgetPageUser }),
}))

vi.mock("@/contexts/BudgetContext", () => ({
  useBudgets: () => window.__budgetPageBudgetContext,
}))

vi.mock("@/contexts/CategoryContext", () => ({
  useCategories: () => window.__budgetPageCategoryContext,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from "@/lib/api"

import BudgetDetails from "@/pages/client/BudgetDetails"

import BudgetNew from "@/pages/client/BudgetNew"

import ClientBudgets from "@/pages/client/Budgets"

const category = {
  id: "category-1",

  name: "Food",

  type: "expense",

  color: "#155C4F",

  isArchived: false,
}

const budget = {
  id: "budget-1",

  name: "Food plan",

  limit: 100,

  period: "monthly",

  startDate: "2026-11-01",

  categoryId: category,

  spending: {
    spent: 85,

    limit: 100,

    remaining: 15,

    percentUsed: 85,

    status: "warning",

    periodStart: "2026-11-01",

    periodEnd: "2026-11-30",
  },
}

function renderPage(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path={
            path === "/client/budgets/budget-1" ? "/client/budgets/:id" : path
          }
          element={element}
        />
        {path !== "/client/budgets/budget-1" && (
          <Route path="/client/budgets/:id" element={<BudgetDetails />} />
        )}
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.__budgetPageUser = { id: "user-1", role: "client", currency: "EUR" }

  window.__budgetPageBudgetContext = {
    budgets: [],

    loading: false,

    error: "",

    refreshBudgets: vi.fn(),

    createBudget: vi.fn().mockResolvedValue({ id: "budget-created" }),

    updateBudget: vi.fn().mockResolvedValue(budget),

    deleteBudget: vi.fn().mockResolvedValue(undefined),

    upsertBudget: vi.fn(),

    removeBudget: vi.fn(),
  }

  window.__budgetPageCategoryContext = {
    categories: [
      category,

      {
        id: "archived-id",
        name: "Archived",
        type: "expense",
        isArchived: true,
      },

      { id: "income-id", name: "Salary", type: "income", isArchived: false },
    ],

    loading: false,

    error: "",
  }

  localStorage.setItem("budgetflow_token", "test-token")

  apiRequest.mockReset()

  apiRequest.mockImplementation((endpoint) => {
    if (endpoint === "budgets/budget-1") {
      return Promise.resolve({ budget: { ...budget, spending: undefined } })
    }

    if (endpoint === "budgets/budget-1/spent") {
      return Promise.resolve(budget.spending)
    }

    return Promise.reject(new Error(`Unexpected request: ${endpoint}`))
  })
})

afterEach(() => {
  cleanup()

  localStorage.clear()

  vi.clearAllMocks()
})

describe("Budget pages", () => {
  it("shows real list spending and refreshes the list on demand", async () => {
    window.__budgetPageBudgetContext.budgets = [budget]

    renderPage("/client/budgets", <ClientBudgets />)

    expect(await screen.findByText("Food plan")).toBeTruthy()

    expect(screen.getByText("Food")).toBeTruthy()

    expect(screen.getByText("Monthly · 2026-11-01")).toBeTruthy()

    expect(screen.getByText(/85% · warning/)).toBeTruthy()

    expect(screen.getByText("+€15.00")).toBeTruthy()

    fireEvent.click(screen.getByText("Refresh"))

    expect(
      window.__budgetPageBudgetContext.refreshBudgets,
    ).toHaveBeenCalledOnce()
  })

  it("creates with categoryId and blocks duplicate category/month submission", async () => {
    renderPage("/client/budgets/new", <BudgetNew />)

    expect(screen.queryByRole("option", { name: "Archived" })).toBeNull()

    expect(screen.queryByRole("option", { name: "Salary" })).toBeNull()

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "November food" },
    })

    fireEvent.change(screen.getByLabelText("Expense category"), {
      target: { value: "category-1" },
    })

    fireEvent.change(screen.getByLabelText("Budget month"), {
      target: { value: "2026-11" },
    })

    fireEvent.change(screen.getByLabelText(/Budget limit/), {
      target: { value: "125.50" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }))

    await waitFor(() => {
      expect(
        window.__budgetPageBudgetContext.createBudget,
      ).toHaveBeenCalledWith({
        name: "November food",

        limit: 125.5,

        categoryId: "category-1",

        period: "monthly",

        startDate: "2026-11-01",
      })
    })

    window.__budgetPageBudgetContext.budgets = [budget]

    window.__budgetPageBudgetContext.createBudget.mockClear()

    cleanup()

    renderPage("/client/budgets/new", <BudgetNew />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Duplicate food" },
    })

    fireEvent.change(screen.getByLabelText("Expense category"), {
      target: { value: "category-1" },
    })

    fireEvent.change(screen.getByLabelText("Budget month"), {
      target: { value: "2026-11" },
    })

    fireEvent.change(screen.getByLabelText(/Budget limit/), {
      target: { value: "100" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "A budget already exists for this category and month.",
    )

    expect(window.__budgetPageBudgetContext.createBudget).not.toHaveBeenCalled()
  })

  it("uses the authenticated account currency precision for budget limits", async () => {
    window.__budgetPageUser.currency = "TND"

    renderPage("/client/budgets/new", <BudgetNew />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "TND budget" },
    })

    fireEvent.change(screen.getByLabelText("Expense category"), {
      target: { value: "category-1" },
    })

    fireEvent.change(screen.getByLabelText("Budget month"), {
      target: { value: "2026-11" },
    })

    fireEvent.change(screen.getByLabelText(/Budget limit/), {
      target: { value: "1.234" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create budget" }))

    await waitFor(() => {
      expect(
        window.__budgetPageBudgetContext.createBudget,
      ).toHaveBeenCalledWith({
        name: "TND budget",

        limit: 1.234,

        categoryId: "category-1",

        period: "monthly",

        startDate: "2026-11-01",
      })
    })
  })

  it("loads the selected budget and spending, then updates and deletes it", async () => {
    window.__budgetPageBudgetContext.budgets = [budget]

    renderPage("/client/budgets/budget-1", <BudgetDetails />)

    expect(await screen.findByText("85% used")).toBeTruthy()

    expect(screen.getByText("Food · Monthly · 2026-11-01")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledWith(
      "budgets/budget-1",

      expect.objectContaining({ token: "test-token" }),
    )

    expect(apiRequest).toHaveBeenCalledWith(
      "budgets/budget-1/spent",

      expect.objectContaining({ token: "test-token" }),
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Updated food plan" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(
        window.__budgetPageBudgetContext.updateBudget,
      ).toHaveBeenCalledWith("budget-1", {
        name: "Updated food plan",

        limit: 100,

        startDate: "2026-11-01",
      })
    })

    fireEvent.click(screen.getByRole("button", { name: "Delete budget" }))

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(
        window.__budgetPageBudgetContext.deleteBudget,
      ).toHaveBeenCalledWith("budget-1")
    })
  })
})
