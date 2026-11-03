import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }))

vi.mock("@/contexts/CategoryContext", () => ({ useCategories: vi.fn() }))

vi.mock("@/contexts/TransactionContext", () => ({ useTransactions: vi.fn() }))

import { useAuth } from "@/contexts/AuthContext"

import { useCategories } from "@/contexts/CategoryContext"

import { useTransactions } from "@/contexts/TransactionContext"

import ClientCategories from "@/pages/client/Categories"

const category = {
  id: "category-1",

  name: "Food",

  type: "expense",

  color: "#4E9B8D",

  icon: "tag",

  isArchived: false,
}

let categoryContext

function renderPage(categoryOverrides = {}, transactionOverrides = {}) {
  useCategories.mockReturnValue({ ...categoryContext, ...categoryOverrides })

  useTransactions.mockReturnValue({
    transactions: [],

    loading: false,

    error: "",

    ...transactionOverrides,
  })

  return render(<ClientCategories />)
}

beforeEach(() => {
  categoryContext = {
    categories: [category],

    loading: false,

    error: "",

    refreshCategories: vi.fn().mockResolvedValue(true),

    createCategory: vi.fn().mockResolvedValue({
      id: "category-2",

      name: "Travel",

      type: "expense",
    }),

    updateCategory: vi.fn().mockResolvedValue({
      ...category,

      name: "Groceries",
    }),

    deleteCategory: vi.fn().mockResolvedValue({
      action: "deleted",

      categoryId: category.id,
    }),
  }

  useAuth.mockReturnValue({ user: { currency: "USD" } })
})

afterEach(() => {
  cleanup()

  vi.clearAllMocks()
})

describe("ClientCategories", () => {
  it("renders active categories and usage from TransactionContext in the configured currency", () => {
    renderPage(
      {
        categories: [
          category,

          { ...category, id: "archived-1", name: "Old food", isArchived: true },

          { ...category, id: "income-1", name: "Salary", type: "income" },
        ],
      },

      {
        transactions: [
          {
            id: "tx-1",
            categoryId: "category-1",
            category: "Food",
            type: "expense",
            amount: 10,
          },

          { id: "tx-2", category: "Food", type: "expense", amount: 5.75 },

          {
            id: "tx-pending",
            categoryId: "category-1",
            category: "Food",
            type: "expense",
            amount: 100,
            status: "pending",
          },

          {
            id: "tx-3",
            categoryId: "different-category",
            category: "Food",
            type: "expense",
            amount: 2,
          },
        ],
      },
    )

    expect(screen.getByText("Food", { selector: "td" })).toBeTruthy()

    expect(screen.queryByText("Old food")).toBeNull()

    expect(screen.getByText("All categories (2)")).toBeTruthy()

    expect(screen.getByText("Income (1)")).toBeTruthy()

    expect(screen.getByText("Expense (1)")).toBeTruthy()

    expect(screen.getByText("3")).toBeTruthy()

    expect(
      screen.getByText(
        new Intl.NumberFormat("en-GB", {
          style: "currency",

          currency: "USD",
        }).format(-15.75),
      ),
    ).toBeTruthy()
  })

  it("shows the initial category loading state", () => {
    renderPage({ categories: [], loading: true })

    expect(screen.getByRole("status").textContent).toContain(
      "Loading categories",
    )
  })

  it("shows API errors and retries category loading", () => {
    renderPage({ categories: [], error: "Categories unavailable" })

    expect(screen.getByRole("alert").textContent).toBe("Categories unavailable")

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(categoryContext.refreshCategories).toHaveBeenCalledOnce()
  })

  it("shows an empty state with an action to add the first category", () => {
    renderPage({ categories: [] })

    expect(screen.getByText("No categories yet")).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    expect(screen.getByRole("dialog").textContent).toContain("Add category")
  })

  it("shows a selectable visual color picker with a preview", () => {
    renderPage({ categories: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    const colorPicker = screen.getByLabelText("Choose category color")
    expect(colorPicker.type).toBe("color")
    expect(colorPicker.value).toBe("#155c4f")

    fireEvent.change(colorPicker, { target: { value: "#aabbcc" } })

    expect(colorPicker.value).toBe("#aabbcc")
    expect(
      screen.getByRole("img", { name: "Selected color preview" }).style
        .backgroundColor,
    ).toBe("rgb(170, 187, 204)")
  })

  it("creates a category with the selected color, closes, and resets the form after success", async () => {
    renderPage({ categories: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Travel" },
    })

    fireEvent.change(screen.getByLabelText("Choose category color"), {
      target: { value: "#aabbcc" },
    })

    fireEvent.change(screen.getByLabelText("Icon (optional)"), {
      target: { value: "plane" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create category" }))

    expect(categoryContext.createCategory).toHaveBeenCalledWith({
      name: "Travel",

      type: "expense",

      color: "#aabbcc",

      icon: "plane",
    })

    expect(await screen.findByText("Category created.")).toBeTruthy()

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )
    expect(screen.getByLabelText("Name").value).toBe("")
    expect(screen.getByLabelText("Type").value).toBe("expense")
    expect(screen.getByLabelText("Choose category color").value).toBe("#155c4f")
    expect(screen.getByLabelText("Icon (optional)").value).toBe("")
  })

  it("keeps entered values and the form open after a create error", async () => {
    categoryContext.createCategory.mockRejectedValue(
      new Error("Could not create category"),
    )

    renderPage({ categories: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Travel" },
    })

    fireEvent.change(screen.getByLabelText("Choose category color"), {
      target: { value: "#aabbcc" },
    })

    fireEvent.change(screen.getByLabelText("Icon (optional)"), {
      target: { value: "plane" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create category" }))

    expect(await screen.findByText("Could not create category")).toBeTruthy()

    expect(screen.getByRole("dialog")).toBeTruthy()

    expect(screen.getByLabelText("Name").value).toBe("Travel")

    expect(screen.getByLabelText("Choose category color").value).toBe("#aabbcc")

    expect(screen.getByLabelText("Icon (optional)").value).toBe("plane")
  })

  it("validates the required name before creating", () => {
    renderPage({ categories: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    fireEvent.click(screen.getByRole("button", { name: "Create category" }))

    expect(screen.getByText("Name is required.")).toBeTruthy()

    expect(categoryContext.createCategory).not.toHaveBeenCalled()
  })

  it("prevents duplicate create submissions while the request is pending", async () => {
    let finishCreate

    categoryContext.createCategory.mockReturnValue(
      new Promise((resolve) => {
        finishCreate = resolve
      }),
    )

    renderPage({ categories: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Add your first category" }),
    )

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Travel" },
    })

    const submit = screen.getByRole("button", { name: "Create category" })

    fireEvent.click(submit)

    await waitFor(() => expect(submit.disabled).toBe(true))

    fireEvent.click(submit)

    expect(categoryContext.createCategory).toHaveBeenCalledOnce()

    await act(async () =>
      finishCreate({ id: "category-2", name: "Travel", type: "expense" }),
    )

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("edits a category with its current values and closes after success", async () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Edit Food" }))

    expect(screen.getByLabelText("Name").value).toBe("Food")

    expect(screen.getByLabelText("Choose category color").value).toBe("#4e9b8d")

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Groceries" },
    })

    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "income" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(categoryContext.updateCategory).toHaveBeenCalledWith("category-1", {
      name: "Groceries",

      type: "income",

      color: "#4E9B8D",

      icon: "tag",
    })

    expect(await screen.findByText("Category updated.")).toBeTruthy()

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("keeps edited values when the update request fails", async () => {
    categoryContext.updateCategory.mockRejectedValue(
      new Error("Could not update category"),
    )

    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Edit Food" }))

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Groceries" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByText("Could not update category")).toBeTruthy()

    expect(screen.getByRole("dialog")).toBeTruthy()

    expect(screen.getByLabelText("Name").value).toBe("Groceries")

    expect(screen.getByText("Food", { selector: "td" })).toBeTruthy()
  })

  it("uses the default color when an edited category has no saved color", () => {
    renderPage({
      categories: [{ ...category, color: undefined }],
    })

    fireEvent.click(screen.getByRole("button", { name: "Edit Food" }))

    expect(screen.getByLabelText("Choose category color").value).toBe("#155c4f")
  })

  it("reports permanent deletion when the API returns action deleted", async () => {
    categoryContext.deleteCategory.mockResolvedValue({
      action: "deleted",

      categoryId: category.id,
    })

    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Delete Food" }))

    fireEvent.click(screen.getByRole("button", { name: "Remove category" }))

    expect(categoryContext.deleteCategory).toHaveBeenCalledWith("category-1")

    expect(
      await screen.findByText("Category permanently deleted."),
    ).toBeTruthy()
  })

  it("reports archival when the API returns action archived", async () => {
    categoryContext.deleteCategory.mockResolvedValue({
      action: "archived",

      category: { ...category, isArchived: true },
    })

    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Delete Food" }))

    fireEvent.click(screen.getByRole("button", { name: "Remove category" }))

    expect(categoryContext.deleteCategory).toHaveBeenCalledWith("category-1")

    expect(
      await screen.findByText(
        "Category archived. Transaction history was preserved.",
      ),
    ).toBeTruthy()
  })

  it("does not call the API when delete confirmation is cancelled", () => {
    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Delete Food" }))

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(categoryContext.deleteCategory).not.toHaveBeenCalled()

    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
