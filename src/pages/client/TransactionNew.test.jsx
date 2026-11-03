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

import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

vi.mock("@/contexts/CategoryContext", () => ({ useCategories: vi.fn() }))

vi.mock("@/contexts/TransactionContext", () => ({ useTransactions: vi.fn() }))

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }))

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { useAuth } from "@/contexts/AuthContext"

import { useCategories } from "@/contexts/CategoryContext"

import { useTransactions } from "@/contexts/TransactionContext"

import { apiRequest } from "@/lib/api"

import {
  getTransactionDraftKey,
  saveTransactionDraft,
} from "@/utils/transactionDrafts"
import { getLocalDateString } from "@/utils/calendarDates"

import TransactionNew from "@/pages/client/TransactionNew"

const categories = [
  {
    id: "507f1f77bcf86cd799439011",
    name: "Food",
    type: "expense",
    isArchived: false,
  },

  {
    id: "507f1f77bcf86cd799439012",
    name: "Salary",
    type: "income",
    isArchived: false,
  },

  {
    id: "507f1f77bcf86cd799439013",
    name: "Old food",
    type: "expense",
    isArchived: true,
  },
]

let categoryContext

let upsertTransaction

let authUser

function LocationDisplay() {
  const location = useLocation()

  return (
    <output data-testid="location">
      {location.pathname}|{location.state?.successMessage || ""}
    </output>
  )
}

function renderPage(path = "/client/transactions/new") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/client/transactions/new" element={<TransactionNew />} />
        <Route
          path="/client/transactions/:id/edit"
          element={<TransactionNew />}
        />
        <Route path="/client/transactions" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setRequiredTransactionFields() {
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Monthly expense" },
  })

  fireEvent.change(screen.getByLabelText("Amount"), {
    target: { value: "25.50" },
  })
}

function categorySelect() {
  return screen.getByLabelText("Category")
}

function mockEditTransaction(transaction, updatedTransaction = transaction) {
  apiRequest
    .mockResolvedValueOnce({ transaction })
    .mockResolvedValueOnce({ transaction: updatedTransaction })
}

function optionLabels(select) {
  return Array.from(select.options).map((option) => option.textContent)
}

function openInlineCategory() {
  fireEvent.change(categorySelect(), {
    target: { value: "__create_category__" },
  })
  return screen.getByRole("dialog")
}

function enableSuccessfulCategoryCreation() {
  const createCategory = categoryContext.createCategory
  createCategory.mockImplementation(async (data) => {
    const createdCategory = {
      id: "created-category",
      isArchived: false,
      ...data,
    }
    categoryContext = {
      ...categoryContext,
      categories: [...categoryContext.categories, createdCategory],
    }
    useCategories.mockReturnValue(categoryContext)
    return createdCategory
  })
  return createCategory
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

beforeEach(() => {
  localStorage.clear()

  authUser = { id: "user-1" }

  useAuth.mockImplementation(() => ({ user: authUser, loading: false }))

  categoryContext = {
    categories,

    loading: false,

    error: "",

    refreshCategories: vi.fn().mockResolvedValue(true),

    createCategory: vi.fn(),
  }

  upsertTransaction = vi.fn()

  useCategories.mockReturnValue(categoryContext)

  useTransactions.mockReturnValue({ upsertTransaction })

  apiRequest.mockReset()

  apiRequest.mockResolvedValue({
    transaction: { id: "transaction-1", category: "Food" },
  })
})

afterEach(() => {
  cleanup()

  localStorage.clear()

  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("TransactionNew category integration", () => {
  it("waits for authentication restoration before mounting the user form", () => {
    useAuth.mockReturnValue({ user: null, loading: true })

    const view = renderPage()

    expect(screen.getByRole("status").textContent).toContain(
      "Restoring your session",
    )
    expect(screen.queryByLabelText("Description")).toBeNull()
    expect(apiRequest).not.toHaveBeenCalled()

    useAuth.mockReturnValue({ user: authUser, loading: false })
    view.rerender(
      <MemoryRouter initialEntries={["/client/transactions/new"]}>
        <Routes>
          <Route path="/client/transactions/new" element={<TransactionNew />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByLabelText("Description")).toBeTruthy()
  })

  it("uses the account currency precision for amount entry", () => {
    authUser = { id: "user-1", currency: "TND" }
    renderPage()

    const amountInput = screen.getByLabelText("Amount")
    expect(amountInput.getAttribute("step")).toBe("0.001")
    expect(amountInput.getAttribute("min")).toBe("0.001")
    expect(screen.getByText("TND")).toBeTruthy()
  })

  it("defaults the create form date from local calendar components", () => {
    renderPage()

    expect(screen.getByLabelText("Date").value).toBe(getLocalDateString())
  })

  it("shows only active Expense categories by default", () => {
    renderPage()

    expect(optionLabels(categorySelect())).toEqual([
      "Select category",
      "Food",
      "+ Create new category",
    ])
  })

  it("shows only active Income categories", () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Income" }))

    expect(optionLabels(categorySelect())).toEqual([
      "Select category",
      "Salary",
      "+ Create new category",
    ])
  })

  it("updates available categories and clears selection when type changes", () => {
    renderPage()

    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })

    expect(categorySelect().value).toBe(categories[0].id)

    fireEvent.click(screen.getByRole("button", { name: "Income" }))

    expect(categorySelect().value).toBe("")

    expect(optionLabels(categorySelect())).toEqual([
      "Select category",
      "Salary",
      "+ Create new category",
    ])
  })

  it("sends the selected real category ID and existing transaction fields on creation", async () => {
    renderPage()

    setRequiredTransactionFields()
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2024-02-29" },
    })

    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce())

    const [endpoint, options] = apiRequest.mock.calls[0]

    expect(endpoint).toBe("transactions")

    expect(options.method).toBe("POST")

    expect(options.body).toEqual(
      expect.objectContaining({
        description: "Monthly expense",

        amount: 25.5,

        category: "Food",

        categoryId: categories[0].id,

        type: "expense",

        paymentMethod: "Credit card",

        note: "",

        status: "completed",
        date: "2024-02-29",
      }),
    )

    expect(options.body).not.toHaveProperty("userId")
    expect(screen.getByLabelText("Status").value).toBe("completed")

    expect(upsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "transaction-1" }),
    )

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/client/transactions|Transaction created.",
      ),
    )
    expect(localStorage.getItem(getTransactionDraftKey("user-1"))).toBeNull()
  })

  it("opens and closes the inline category modal without losing transaction fields", () => {
    renderPage()
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Payroll  " },
    })
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "123.45" },
    })
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })

    const dialog = openInlineCategory()
    expect(within(dialog).getByLabelText("Category name")).toBeTruthy()
    expect(screen.getByLabelText("Description").value).toBe("  Payroll  ")
    expect(screen.getByLabelText("Amount").value).toBe("123.45")
    expect(categorySelect().value).toBe(categories[0].id)

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByLabelText("Description").value).toBe("  Payroll  ")
    expect(screen.getByLabelText("Amount").value).toBe("123.45")
    expect(categorySelect().value).toBe(categories[0].id)
  })

  it.each([
    ["expense", "expense", "New expense"],
    ["income", "income", "New income"],
  ])(
    "creates and selects the returned %s category ID for the transaction",
    async (buttonType, expectedType, name) => {
      renderPage()
      enableSuccessfulCategoryCreation()

      if (buttonType === "income") {
        fireEvent.click(screen.getByRole("button", { name: "Income" }))
      }

      const dialog = openInlineCategory()
      fireEvent.change(within(dialog).getByLabelText("Category name"), {
        target: { value: `  ${name}  ` },
      })
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Create category" }),
      )

      await waitFor(() => {
        expect(categorySelect().value).toBe("created-category")
      })
      expect(categoryContext.createCategory).toHaveBeenCalledWith({
        name,
        type: expectedType,
      })
      expect(screen.queryByRole("dialog")).toBeNull()
      expect(screen.getByText("Category created and selected.")).toBeTruthy()
    },
  )

  it("sends an optional chosen color through CategoryContext", async () => {
    renderPage()
    enableSuccessfulCategoryCreation()
    const dialog = openInlineCategory()
    fireEvent.change(within(dialog).getByLabelText("Category name"), {
      target: { value: "Health" },
    })
    fireEvent.click(
      within(dialog).getByLabelText("Choose a category color (optional)"),
    )
    fireEvent.change(within(dialog).getByLabelText("Choose category color"), {
      target: { value: "#123ABC" },
    })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create category" }),
    )

    await waitFor(() =>
      expect(categoryContext.createCategory).toHaveBeenCalledWith({
        name: "Health",
        type: "expense",
        color: "#123abc",
      }),
    )
  })

  it("validates an empty inline category name without making a request", () => {
    renderPage()
    const dialog = openInlineCategory()

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create category" }),
    )

    expect(within(dialog).getByRole("alert").textContent).toBe(
      "Enter a category name.",
    )
    expect(categoryContext.createCategory).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("keeps the inline form open and preserves its name after a duplicate error", async () => {
    categoryContext.createCategory.mockRejectedValue(
      Object.assign(
        new Error("A category with this name and type already exists."),
        { status: 409 },
      ),
    )
    renderPage()
    const dialog = openInlineCategory()
    const nameInput = within(dialog).getByLabelText("Category name")
    fireEvent.change(nameInput, { target: { value: "Food" } })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create category" }),
    )

    expect(await within(dialog).findByRole("alert")).toBeTruthy()
    expect(nameInput.value).toBe("Food")
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByLabelText("Description").value).toBe("")
  })

  it("keeps the inline form open and preserves values after a network error", async () => {
    categoryContext.createCategory.mockRejectedValue(
      new Error("Network unavailable"),
    )
    renderPage()
    const dialog = openInlineCategory()
    const nameInput = within(dialog).getByLabelText("Category name")
    fireEvent.change(nameInput, { target: { value: "Travel" } })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create category" }),
    )

    expect((await within(dialog).findByRole("alert")).textContent).toContain(
      "Network unavailable",
    )
    expect(nameInput.value).toBe("Travel")
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("prevents duplicate inline category submissions", async () => {
    const request = deferred()
    categoryContext.createCategory.mockReturnValue(request.promise)
    renderPage()
    const dialog = openInlineCategory()
    fireEvent.change(within(dialog).getByLabelText("Category name"), {
      target: { value: "Travel" },
    })
    const submit = within(dialog).getByRole("button", {
      name: "Create category",
    })

    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(categoryContext.createCategory).toHaveBeenCalledOnce()
    expect(submit.disabled).toBe(true)

    const createdCategory = {
      id: "created-category",
      name: "Travel",
      type: "expense",
      isArchived: false,
    }
    categoryContext = {
      ...categoryContext,
      categories: [...categoryContext.categories, createdCategory],
    }
    useCategories.mockReturnValue(categoryContext)
    await act(async () => request.resolve(createdCategory))
    await waitFor(() => expect(categorySelect().value).toBe("created-category"))
  })

  it("requires a valid category when active categories exist for the selected type", () => {
    renderPage()

    setRequiredTransactionFields()

    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    expect(screen.getByRole("alert").textContent).toContain(
      "compatible category",
    )

    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("shows an empty category state and a link to manage categories", () => {
    useCategories.mockReturnValue({ ...categoryContext, categories: [] })

    renderPage()

    expect(
      screen.getByText("No active expense categories are available."),
    ).toBeTruthy()

    expect(
      screen
        .getByRole("link", { name: "Manage categories" })
        .getAttribute("href"),
    )

      .toBe("/client/categories")

    expect(categorySelect().options).toHaveLength(2)
  })

  it("shows category loading and API error states with retry", () => {
    useCategories.mockReturnValue({
      ...categoryContext,

      loading: true,

      categories: [],
    })

    const { rerender } = renderPage()

    expect(screen.getByText("Loading categories...")).toBeTruthy()

    expect(categorySelect().disabled).toBe(true)

    useCategories.mockReturnValue({
      ...categoryContext,

      categories: [],

      error: "Categories unavailable",
    })

    rerender(
      <MemoryRouter initialEntries={["/client/transactions/new"]}>
        <Routes>
          <Route path="/client/transactions/new" element={<TransactionNew />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("alert").textContent).toContain(
      "Categories unavailable",
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry categories" }))

    expect(categoryContext.refreshCategories).toHaveBeenCalledOnce()
  })

  it("prevents duplicate submissions while the transaction request is pending", async () => {
    let finishRequest

    apiRequest.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve
      }),
    )

    renderPage()

    setRequiredTransactionFields()

    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })

    const submit = screen.getByRole("button", { name: "Save transaction" })

    fireEvent.click(submit)

    fireEvent.click(submit)

    expect(apiRequest).toHaveBeenCalledOnce()

    expect(submit.disabled).toBe(true)

    await act(async () =>
      finishRequest({
        transaction: { id: "transaction-1", category: "Food" },
      }),
    )

    await waitFor(() => expect(submit.disabled).toBe(false))
  })

  it("loads an existing linked transaction and keeps edit submission compatible", async () => {
    const transaction = {
      id: "transaction-1",

      description: "Existing grocery purchase",

      amount: 20,

      category: "Food",

      categoryId: categories[0].id,

      type: "expense",

      date: "2026-10-30",

      paymentMethod: "Cash",

      note: "Receipt",
    }

    apiRequest

      .mockResolvedValueOnce({ transaction })

      .mockResolvedValueOnce({
        transaction: { ...transaction, description: "Updated purchase" },
      })

    renderPage("/client/transactions/transaction-1/edit")

    expect(
      await screen.findByDisplayValue("Existing grocery purchase"),
    ).toBeTruthy()

    expect(categorySelect().value).toBe(categories[0].id)
    expect(screen.getByLabelText("Date").value).toBe("2026-10-30")

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated purchase" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))

    expect(apiRequest.mock.calls[1][0]).toBe("transactions/transaction-1")

    expect(apiRequest.mock.calls[1][1].method).toBe("PATCH")

    expect(apiRequest.mock.calls[1][1].body).toEqual(
      expect.objectContaining({
        category: "Food",

        categoryId: categories[0].id,

        paymentMethod: "Cash",

        note: "Receipt",
        date: "2026-10-30",
      }),
    )

    expect(apiRequest.mock.calls[1][1].body.status).toBe("completed")

    expect(screen.getByLabelText("Description").value).toBe("Updated purchase")
  })

  it("preserves a legacy category without automatically adding a category ID", async () => {
    useCategories.mockReturnValue({ ...categoryContext, categories: [] })

    const transaction = {
      id: "transaction-legacy",

      description: "Legacy purchase",

      amount: 12,

      category: "Old free-text group",

      type: "expense",

      date: "2026-10-30",

      paymentMethod: "",

      note: "",
    }

    apiRequest

      .mockResolvedValueOnce({ transaction })

      .mockResolvedValueOnce({
        transaction: { ...transaction, description: "Edited legacy purchase" },
      })

    renderPage("/client/transactions/transaction-legacy/edit")

    expect(
      await screen.findByRole("option", {
        name: "Old free-text group (legacy, unlinked)",
      }),
    ).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Edited legacy purchase" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))

    expect(apiRequest.mock.calls[1][1].body.category).toBe(
      "Old free-text group",
    )

    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("creates a pending transaction when Pending is selected", async () => {
    renderPage()
    setRequiredTransactionFields()
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "pending" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledOnce())
    expect(apiRequest.mock.calls[0][1].body.status).toBe("pending")
  })

  it("rejects an invalid calendar date before submitting", () => {
    renderPage()
    setRequiredTransactionFields()
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-02-29" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    expect(screen.getByRole("alert").textContent).toContain("valid date")
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("allows editing status and defaults legacy transactions to completed", async () => {
    const transaction = {
      id: "legacy-status-transaction",
      description: "Legacy transaction",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "",
    }
    apiRequest.mockResolvedValueOnce({ transaction }).mockResolvedValueOnce({
      transaction: { ...transaction, status: "pending" },
    })

    renderPage("/client/transactions/legacy-status-transaction/edit")
    await screen.findByDisplayValue("Legacy transaction")
    expect(screen.getByLabelText("Status").value).toBe("completed")
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "pending" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body.status).toBe("pending")
  })

  it("saves an unchanged legacy transaction when active categories exist", async () => {
    const transaction = {
      id: "transaction-legacy",
      description: "Legacy purchase",
      amount: 12,
      category: "Old free-text group",
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-legacy/edit")

    await screen.findByDisplayValue("Legacy purchase")
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body.category).toBe(
      "Old free-text group",
    )
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("keeps a same-name legacy category distinct from the active category", async () => {
    const transaction = {
      id: "transaction-legacy",
      description: "Legacy food purchase",
      amount: 12,
      category: "Food",
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-legacy/edit")

    await screen.findByDisplayValue("Legacy food purchase")
    expect(optionLabels(categorySelect())).toEqual([
      "Select category",
      "Food",
      "+ Create new category",
      "Food (legacy, unlinked)",
    ])
    expect(categorySelect().value).toBe("__legacy_category__")

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body.category).toBe("Food")
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("preserves a legacy category string when editing other fields", async () => {
    const transaction = {
      id: "transaction-legacy",
      description: "Legacy purchase",
      amount: 12,
      category: "Original legacy category",
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-legacy/edit")

    await screen.findByDisplayValue("Legacy purchase")
    fireEvent.change(categorySelect(), {
      target: { value: "__create_category__" },
    })
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(categorySelect().value).toBe("__legacy_category__")

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated legacy purchase" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body).toEqual(
      expect.objectContaining({
        description: "Updated legacy purchase",
        category: "Original legacy category",
      }),
    )
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("allows saving an unchanged archived linked transaction", async () => {
    const transaction = {
      id: "transaction-archived",
      description: "Archived category purchase",
      amount: 12,
      category: "Old food",
      categoryId: categories[2].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-archived/edit")

    await screen.findByDisplayValue("Archived category purchase")
    expect(screen.getByRole("status").textContent).toContain(
      "archived historical category",
    )

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body.category).toBe("Old food")
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("retains the archived category ID and name as the unchanged edit baseline", async () => {
    const transaction = {
      id: "transaction-archived",
      description: "Archived category purchase",
      amount: 12,
      category: "Old food",
      categoryId: categories[2].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-archived/edit")

    await screen.findByDisplayValue("Archived category purchase")
    expect(categorySelect().value).toBe(categories[2].id)
    fireEvent.change(categorySelect(), {
      target: { value: "__create_category__" },
    })
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(categorySelect().value).toBe(categories[2].id)
    expect(
      await screen.findByRole("option", {
        name: "Old food (archived historical category)",
      }),
    ).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated archived purchase" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body).toEqual(
      expect.objectContaining({
        description: "Updated archived purchase",
        category: "Old food",
      }),
    )
    expect(apiRequest.mock.calls[1][1].body).not.toHaveProperty("categoryId")
  })

  it("replaces an archived linked category only after an active category is selected", async () => {
    const transaction = {
      id: "transaction-archived",
      description: "Archived category purchase",
      amount: 12,
      category: "Old food",
      categoryId: categories[2].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    mockEditTransaction(transaction)

    renderPage("/client/transactions/transaction-archived/edit")

    await screen.findByDisplayValue("Archived category purchase")
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(apiRequest.mock.calls[1][1].body).toEqual(
      expect.objectContaining({
        category: "Food",
        categoryId: categories[0].id,
      }),
    )
  })

  it("requires an explicit compatible category after changing a legacy transaction type", async () => {
    const transaction = {
      id: "transaction-legacy",
      description: "Legacy purchase",
      amount: 12,
      category: "Old free-text group",
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    apiRequest.mockResolvedValueOnce({ transaction })

    renderPage("/client/transactions/transaction-legacy/edit")

    await screen.findByDisplayValue("Legacy purchase")
    fireEvent.click(screen.getByRole("button", { name: "Income" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(screen.getByRole("alert").textContent).toContain(
      "Choose an active income category",
    )
    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it("does not preserve an archived category when the transaction type changes", async () => {
    const transaction = {
      id: "transaction-archived",
      description: "Archived category purchase",
      amount: 12,
      category: "Old food",
      categoryId: categories[2].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "",
      note: "",
    }
    apiRequest.mockResolvedValueOnce({ transaction })

    renderPage("/client/transactions/transaction-archived/edit")

    await screen.findByDisplayValue("Archived category purchase")
    fireEvent.click(screen.getByRole("button", { name: "Income" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(screen.getByRole("alert").textContent).toContain(
      "Choose an active income category",
    )
    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it("preserves edited form values and displays an update error", async () => {
    const transaction = {
      id: "transaction-1",
      description: "Existing grocery purchase",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "Receipt",
    }
    apiRequest
      .mockResolvedValueOnce({ transaction })
      .mockRejectedValueOnce(new Error("Update failed"))

    renderPage("/client/transactions/transaction-1/edit")

    await screen.findByDisplayValue("Existing grocery purchase")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Keep my edited description" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Update failed",
    )
    expect(screen.getByLabelText("Description").value).toBe(
      "Keep my edited description",
    )
    expect(categorySelect().value).toBe(categories[0].id)
    expect(
      JSON.parse(
        localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
      ).fields.description,
    ).toBe("Keep my edited description")
  })

  it("saves and restores a create draft after remounting", async () => {
    const firstRender = renderPage()

    setRequiredTransactionFields()
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.click(screen.getByRole("button", { name: "Income" }))
    fireEvent.change(categorySelect(), {
      target: { value: categories[1].id },
    })
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2024-02-29" },
    })
    fireEvent.change(screen.getByLabelText("Payment method"), {
      target: { value: "Cash" },
    })
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Keep this note" },
    })
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "pending" },
    })

    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem(getTransactionDraftKey("user-1")),
      )
      expect(saved.fields.note).toBe("Keep this note")
      expect(saved.fields.status).toBe("pending")
    })
    firstRender.unmount()

    renderPage()

    expect(await screen.findByDisplayValue("Monthly expense")).toBeTruthy()
    expect(screen.getByLabelText("Amount").value).toBe("25.50")
    expect(screen.getByLabelText("Date").value).toBe("2024-02-29")
    expect(screen.getByLabelText("Payment method").value).toBe("Cash")
    expect(screen.getByLabelText("Note").value).toBe("Keep this note")
    expect(screen.getByLabelText("Status").value).toBe("pending")
    expect(categorySelect().value).toBe(categories[1].id)
    expect(
      screen
        .getByRole("button", { name: "Income" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
  })

  it("isolates drafts between authenticated users", async () => {
    const firstRender = renderPage()
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Private user one draft" },
    })
    await waitFor(() =>
      expect(
        localStorage.getItem(getTransactionDraftKey("user-1")),
      ).not.toBeNull(),
    )
    firstRender.unmount()

    authUser = { id: "user-2" }
    renderPage()
    expect(screen.getByLabelText("Description").value).toBe("")
    expect(
      localStorage.getItem(getTransactionDraftKey("user-2")),
    ).not.toContain("Private user one draft")
  })

  it("restores an edit draft only for its matching user and transaction", async () => {
    const transaction = {
      id: "transaction-1",
      description: "Server description",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "Server note",
      updatedAt: "2026-10-30T12:00:00.000Z",
    }

    apiRequest.mockReset()
    apiRequest.mockResolvedValueOnce({ transaction })
    const firstRender = renderPage("/client/transactions/transaction-1/edit")
    await screen.findByDisplayValue("Server description")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Unfinished edit" },
    })
    await waitFor(() =>
      expect(
        localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
      ).not.toBeNull(),
    )
    firstRender.unmount()

    authUser = { id: "user-2" }
    apiRequest.mockResolvedValueOnce({ transaction })
    const otherUserRender = renderPage(
      "/client/transactions/transaction-1/edit",
    )
    expect(await screen.findByDisplayValue("Server description")).toBeTruthy()
    otherUserRender.unmount()

    authUser = { id: "user-1" }
    apiRequest.mockResolvedValueOnce({ transaction })
    renderPage("/client/transactions/transaction-1/edit")
    expect(await screen.findByDisplayValue("Unfinished edit")).toBeTruthy()
  })

  it("does not apply an edit draft to a different transaction", async () => {
    const firstTransaction = {
      id: "transaction-1",
      description: "First server transaction",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "",
      updatedAt: "2026-10-30T12:00:00.000Z",
    }
    apiRequest.mockReset()
    apiRequest.mockResolvedValueOnce({ transaction: firstTransaction })
    const firstRender = renderPage("/client/transactions/transaction-1/edit")
    await screen.findByDisplayValue("First server transaction")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Draft for transaction one" },
    })
    await waitFor(() =>
      expect(
        localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
      ).not.toBeNull(),
    )
    firstRender.unmount()

    apiRequest.mockResolvedValueOnce({
      transaction: {
        ...firstTransaction,
        id: "transaction-2",
        description: "Second server transaction",
      },
    })
    renderPage("/client/transactions/transaction-2/edit")
    expect(
      await screen.findByDisplayValue("Second server transaction"),
    ).toBeTruthy()
    expect(screen.getByLabelText("Description").value).not.toBe(
      "Draft for transaction one",
    )
  })

  it("discards an edit draft when the server transaction has changed", async () => {
    const transaction = {
      id: "transaction-1",
      description: "Server description",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "",
      updatedAt: "2026-10-30T12:00:00.000Z",
    }
    apiRequest.mockReset()
    apiRequest.mockResolvedValueOnce({ transaction })
    const firstRender = renderPage("/client/transactions/transaction-1/edit")
    await screen.findByDisplayValue("Server description")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Stale edit" },
    })
    await waitFor(() =>
      expect(
        localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
      ).not.toBeNull(),
    )
    firstRender.unmount()

    apiRequest.mockResolvedValueOnce({
      transaction: {
        ...transaction,
        description: "New server description",
        updatedAt: "2026-10-31T12:00:00.000Z",
      },
    })
    renderPage("/client/transactions/transaction-1/edit")
    expect(
      await screen.findByDisplayValue("New server description"),
    ).toBeTruthy()
    expect(screen.getByLabelText("Description").value).not.toBe("Stale edit")
    expect(
      await screen.findByText(
        "A saved edit draft was discarded because this transaction changed on the server.",
      ),
    ).toBeTruthy()
  })

  it("keeps create and edit drafts separate and clears only a successful edit", async () => {
    const createDraft = {
      description: "Separate create draft",
      amount: "",
      type: "expense",
      categoryId: "",
      legacyCategory: "",
      date: "2026-10-31",
      paymentMethod: "Credit card",
      note: "",
    }
    saveTransactionDraft("user-1", null, createDraft, null)

    const transaction = {
      id: "transaction-1",
      description: "Edit server transaction",
      amount: 20,
      category: "Food",
      categoryId: categories[0].id,
      type: "expense",
      date: "2026-10-30",
      paymentMethod: "Cash",
      note: "",
      updatedAt: "2026-10-30T12:00:00.000Z",
    }
    apiRequest.mockReset()
    apiRequest.mockResolvedValueOnce({ transaction }).mockResolvedValueOnce({
      transaction: { ...transaction, description: "Updated" },
    })
    renderPage("/client/transactions/transaction-1/edit")
    await screen.findByDisplayValue("Edit server transaction")
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Edit draft to clear" },
    })
    await waitFor(() =>
      expect(
        localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
      ).not.toBeNull(),
    )
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toContain(
        "Transaction updated.",
      ),
    )
    expect(
      localStorage.getItem(getTransactionDraftKey("user-1", "transaction-1")),
    ).toBeNull()
    expect(
      JSON.parse(localStorage.getItem(getTransactionDraftKey("user-1"))).fields
        .description,
    ).toBe("Separate create draft")
  })

  it("preserves a create draft when submission fails", async () => {
    apiRequest.mockRejectedValue(new Error("Create failed"))
    renderPage()
    setRequiredTransactionFields()
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Create failed",
    )
    expect(
      JSON.parse(localStorage.getItem(getTransactionDraftKey("user-1"))).fields
        .description,
    ).toBe("Monthly expense")
  })

  it("does not clear a newer draft when an older create request finishes", async () => {
    let finishRequest
    apiRequest.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve
      }),
    )
    renderPage()
    setRequiredTransactionFields()
    fireEvent.change(categorySelect(), {
      target: { value: categories[0].id },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save transaction" }))

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Newer unfinished description" },
    })
    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem(getTransactionDraftKey("user-1")),
      )
      expect(saved.fields.description).toBe("Newer unfinished description")
    })

    await act(async () =>
      finishRequest({
        transaction: { id: "transaction-1", category: "Food" },
      }),
    )

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toContain(
        "Transaction created.",
      ),
    )
    expect(
      JSON.parse(localStorage.getItem(getTransactionDraftKey("user-1"))).fields
        .description,
    ).toBe("Newer unfinished description")
  })

  it("discards corrupted draft storage without breaking the form", async () => {
    localStorage.setItem(getTransactionDraftKey("user-1"), "{invalid json")
    renderPage()

    expect(screen.getByLabelText("Description").value).toBe("")
    expect(await screen.findByRole("status")).toBeTruthy()
    await waitFor(() =>
      expect(localStorage.getItem(getTransactionDraftKey("user-1"))).not.toBe(
        "{invalid json",
      ),
    )
  })

  it("continues working and warns when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is unavailable")
    })
    renderPage()

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Still editable" },
    })

    expect(
      await screen.findByText(
        "Local drafts could not be saved in this browser. Your changes may be lost after a refresh.",
      ),
    ).toBeTruthy()
    expect(screen.getByLabelText("Description").value).toBe("Still editable")
  })
})
