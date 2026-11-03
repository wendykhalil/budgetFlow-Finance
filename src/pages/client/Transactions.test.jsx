import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

vi.mock("@/contexts/CategoryContext", () => ({ useCategories: vi.fn() }))

vi.mock("@/contexts/TransactionContext", () => ({ useTransactions: vi.fn() }))
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { currency: "EUR" } }),
}))

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { useCategories } from "@/contexts/CategoryContext"

import { useTransactions } from "@/contexts/TransactionContext"

import { apiRequest } from "@/lib/api"

import ClientTransactions from "@/pages/client/Transactions"

const categoryIds = {
  expenseFood: "507f1f77bcf86cd799439011",

  incomeFood: "507f1f77bcf86cd799439012",

  otherExpense: "507f1f77bcf86cd799439013",
}

const categories = [
  {
    id: categoryIds.expenseFood,
    name: "Food",
    type: "expense",
    isArchived: false,
  },

  {
    id: categoryIds.incomeFood,
    name: "Food",
    type: "income",
    isArchived: false,
  },

  {
    id: categoryIds.otherExpense,
    name: "Transport",
    type: "expense",
    isArchived: false,
  },

  {
    id: "archived-category",
    name: "Archived category",
    type: "expense",
    isArchived: true,
  },
]

const dateThisMonth = (() => {
  const date = new Date()

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-15`
})()

const dateLastMonth = (() => {
  const date = new Date()

  date.setDate(1)

  date.setMonth(date.getMonth() - 1)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-15`
})()

function transaction(overrides) {
  return {
    id: "transaction-default",

    date: dateThisMonth,

    description: "Default transaction",

    category: "Food",

    type: "expense",

    amount: 10,

    status: "completed",

    ...overrides,
  }
}

const sampleTransactions = [
  transaction({
    id: "linked-expense-food",

    description: "Linked expense food",

    categoryId: categoryIds.expenseFood,
  }),

  transaction({
    id: "legacy-expense-food",

    description: "Legacy expense food",
  }),

  transaction({
    id: "linked-income-food",

    description: "Linked income food",

    categoryId: categoryIds.incomeFood,

    type: "income",

    amount: 100,
  }),

  transaction({
    id: "archived-linked",

    description: "Archived-linked purchase",

    category: "Archived category",

    categoryId: "old-archived-id",
  }),

  transaction({
    id: "legacy-historical",

    description: "Legacy historical purchase",

    category: "Legacy historical",
  }),

  transaction({
    id: "last-month",

    description: "Last month purchase",

    categoryId: categoryIds.otherExpense,

    category: "Transport",

    date: dateLastMonth,
  }),
]

let transactionContext

let categoryContext

function LocationDisplay() {
  const location = useLocation()

  return <output data-testid="location">{location.pathname}</output>
}

function renderPage({
  transactions = sampleTransactions,

  transactionOverrides = {},

  categories: categoriesOverride = categories,

  categoryOverrides = {},

  initialEntries = ["/client/transactions"],
} = {}) {
  transactionContext = {
    transactions,

    loading: false,

    error: "",

    refreshTransactions: vi.fn().mockResolvedValue(true),

    removeTransaction: vi.fn(),

    ...transactionOverrides,
  }

  categoryContext = { categories: categoriesOverride, ...categoryOverrides }

  useTransactions.mockReturnValue(transactionContext)

  useCategories.mockReturnValue(categoryContext)

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/client/transactions" element={<ClientTransactions />} />
        <Route
          path="/client/transactions/new"
          element={<p>New transaction route</p>}
        />
        <Route
          path="/client/transactions/:id"
          element={<p>Transaction details route</p>}
        />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
}

function chooseCategory(label) {
  const select = screen.getByLabelText("Filter by category")

  const option = Array.from(select.options).find(
    (item) => item.textContent === label,
  )

  expect(option).toBeTruthy()

  fireEvent.change(select, { target: { value: option.value } })
}

function visibleDescriptions() {
  return screen
    .queryAllByRole("row")
    .slice(1)
    .map(
      (row) => row.querySelector("td:nth-child(2) .font-semibold")?.textContent,
    )
}

beforeEach(() => {
  apiRequest.mockReset()

  apiRequest.mockResolvedValue({ message: "Transaction deleted." })
})

afterEach(() => {
  cleanup()

  vi.clearAllMocks()
})

describe("ClientTransactions category integration", () => {
  it("includes active category options and relevant historical values", () => {
    renderPage()

    const options = Array.from(
      screen.getByLabelText("Filter by category").options,
    ).map((option) => option.textContent)

    expect(options).toContain("Food — Expense (active)")

    expect(options).toContain("Food — Income")

    expect(options).toContain("Transport")

    expect(options).toContain("Archived category")

    expect(options).toContain("Legacy historical")
  })

  it("filters linked transactions by category ID without matching same-name legacy rows", () => {
    renderPage()

    chooseCategory("Food — Expense (active)")

    expect(visibleDescriptions()).toEqual(["Linked expense food"])

    expect(
      screen

        .getByText("Linked expense food")

        .closest("tr")

        .querySelector("td:nth-child(3)").textContent,
    ).toBe("Food")
  })

  it("filters legacy transactions by exact stored category name and type", () => {
    renderPage()

    chooseCategory("Food — Expense (legacy)")

    expect(visibleDescriptions()).toEqual(["Legacy expense food"])
  })

  it("keeps archived linked and historical legacy categories filterable", () => {
    renderPage()

    chooseCategory("Archived category")

    expect(visibleDescriptions()).toEqual(["Archived-linked purchase"])

    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "all" },
    })

    chooseCategory("Legacy historical")

    expect(visibleDescriptions()).toEqual(["Legacy historical purchase"])
  })

  it("shows both types for All and filters category options by Income or Expense", () => {
    renderPage()

    const typeSelect = screen.getByLabelText("Filter by transaction type")

    const categorySelect = screen.getByLabelText("Filter by category")

    expect(
      Array.from(categorySelect.options).map((option) => option.textContent),
    )

      .toContain("Food — Expense (active)")

    expect(
      Array.from(categorySelect.options).map((option) => option.textContent),
    )

      .toContain("Food — Income")

    fireEvent.change(typeSelect, { target: { value: "income" } })

    expect(
      Array.from(categorySelect.options).map((option) => option.textContent),
    )

      .toEqual(["All categories", "Food"])

    fireEvent.change(typeSelect, { target: { value: "expense" } })

    expect(
      Array.from(categorySelect.options).map((option) => option.textContent),
    )

      .toContain("Food — Expense (active)")

    expect(
      Array.from(categorySelect.options).map((option) => option.textContent),
    )

      .not.toContain("Food — Income")
  })

  it("clears only a category selection incompatible with the new type", () => {
    renderPage()

    chooseCategory("Food — Income")

    fireEvent.change(screen.getByLabelText("Filter by transaction type"), {
      target: { value: "expense" },
    })

    expect(screen.getByLabelText("Filter by category").value).toBe("all")

    expect(visibleDescriptions()).not.toContain("Linked income food")
  })

  it("preserves a compatible category selection when narrowing the type", () => {
    renderPage()

    chooseCategory("Food — Expense (active)")

    const selected = screen.getByLabelText("Filter by category").value

    fireEvent.change(screen.getByLabelText("Filter by transaction type"), {
      target: { value: "expense" },
    })

    expect(screen.getByLabelText("Filter by category").value).toBe(selected)

    expect(visibleDescriptions()).toEqual(["Linked expense food"])
  })

  it("preserves global search across description and stored category values", () => {
    renderPage()

    fireEvent.change(screen.getByLabelText("Search transactions..."), {
      target: { value: "archived-linked" },
    })

    expect(visibleDescriptions()).toEqual(["Archived-linked purchase"])
  })

  it("preserves date and type filters", () => {
    renderPage()

    fireEvent.change(screen.getByLabelText("Filter by date"), {
      target: { value: "last-month" },
    })

    expect(visibleDescriptions()).toEqual(["Last month purchase"])

    fireEvent.change(screen.getByLabelText("Filter by date"), {
      target: { value: "this-month" },
    })

    fireEvent.change(screen.getByLabelText("Filter by transaction type"), {
      target: { value: "income" },
    })

    expect(visibleDescriptions()).toEqual(["Linked income food"])
  })

  it("filters by completed and pending status while preserving search filters", () => {
    const transactions = [
      transaction({
        id: "completed-expense",
        description: "Completed food purchase",
        status: "completed",
        categoryId: categoryIds.expenseFood,
      }),
      transaction({
        id: "pending-expense",
        description: "Pending food purchase",
        status: "pending",
        categoryId: categoryIds.expenseFood,
      }),
      transaction({
        id: "legacy-completed-expense",
        description: "Legacy food purchase",
        status: undefined,
        categoryId: categoryIds.expenseFood,
      }),
    ]
    renderPage({ transactions })

    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "pending" },
    })
    expect(visibleDescriptions()).toEqual(["Pending food purchase"])

    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "completed" },
    })
    expect(visibleDescriptions()).toEqual([
      "Completed food purchase",
      "Legacy food purchase",
    ])

    fireEvent.change(screen.getByLabelText("Search transactions..."), {
      target: { value: "legacy" },
    })
    expect(visibleDescriptions()).toEqual(["Legacy food purchase"])
  })

  it("preserves ten-item pagination", () => {
    const transactions = Array.from({ length: 11 }, (_, index) =>
      transaction({
        id: `page-${index}`,

        description: `Page transaction ${index}`,

        category: "Food",
      }),
    )

    renderPage({ transactions })

    expect(visibleDescriptions()).toHaveLength(10)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    expect(visibleDescriptions()).toHaveLength(1)

    expect(visibleDescriptions()).toEqual(["Page transaction 10"])
  })

  it("keeps the existing empty transaction state while showing active filter options", () => {
    renderPage({ transactions: [] })

    expect(
      screen.getByText("You have no transactions yet. Add one to get started."),
    )

      .toBeTruthy()

    expect(
      Array.from(screen.getByLabelText("Filter by category").options)

        .map((option) => option.textContent),
    )

      .toContain("Transport")
  })

  it("preserves the date-descending order supplied by TransactionContext", () => {
    const orderedTransactions = [
      transaction({
        id: "newest",

        description: "Newest transaction",

        date: dateThisMonth,
      }),

      transaction({
        id: "older",

        description: "Older transaction",

        date: dateLastMonth,
      }),
    ]
    renderPage({ transactions: orderedTransactions })
    fireEvent.change(screen.getByLabelText("Filter by date"), {
      target: { value: "all" },
    })

    expect(visibleDescriptions()).toEqual([
      "Newest transaction",

      "Older transaction",
    ])
  })

  it("navigates to transaction details", () => {
    renderPage()

    fireEvent.click(
      screen.getByRole("button", {
        name: "View transaction Linked expense food",
      }),
    )

    expect(screen.getByText("Transaction details route")).toBeTruthy()

    expect(screen.getByTestId("location").textContent).toBe(
      "/client/transactions/linked-expense-food",
    )
  })

  it("confirms and deletes a transaction using the existing API and context action", async () => {
    renderPage()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete transaction Linked expense food",
      }),
    )

    const dialog = screen.getByRole("dialog")

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce())

    expect(apiRequest.mock.calls[0][0]).toBe("transactions/linked-expense-food")

    expect(apiRequest.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "DELETE",
      }),
    )

    expect(transactionContext.removeTransaction).toHaveBeenCalledWith(
      "linked-expense-food",
    )

    expect(await screen.findByText("Transaction deleted.")).toBeTruthy()
  })

  it("shows loading and API error states with retry", () => {
    renderPage({
      transactions: [],

      transactionOverrides: {
        loading: true,

        error: "",
      },
    })

    expect(screen.getByText("Loading transactions...")).toBeTruthy()

    cleanup()

    const refreshTransactions = vi.fn()

    renderPage({
      transactions: [],

      transactionOverrides: {
        loading: false,

        error: "Transactions unavailable",

        refreshTransactions,
      },
    })

    expect(screen.getByRole("alert").textContent).toBe(
      "Transactions unavailable",
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(refreshTransactions).toHaveBeenCalledOnce()
  })
})
