import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AdminTransactions } from "./Transactions"

/**
 * @vitest-environment jsdom
 */

// Mock apiRequest
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))

// Mock useAuth hook
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-user-1", role: "admin" },
    token: "test-token-123",
  }),
}))

import { apiRequest } from "@/lib/api"

const mockTransactions = [
  {
    id: "tx-1",
    userId: {
      id: "user-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    },
    description: "Grocery store",
    category: "Groceries",
    type: "expense",
    amount: 50.25,
    date: "2026-11-01",
    status: "completed",
  },
  {
    id: "tx-2",
    userId: {
      id: "user-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    },
    description: "Salary deposit",
    category: "Salary",
    type: "income",
    amount: 2000.0,
    date: "2026-11-02",
    status: "completed",
  },
  {
    id: "tx-3",
    userId: {
      id: "user-2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
    },
    description: "Restaurant",
    category: "Food",
    type: "expense",
    amount: 30.5,
    date: "2026-11-03",
    status: "pending",
  },
]

const mockResponse = {
  data: mockTransactions,
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    pages: 1,
  },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminTransactions />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiRequest.mockClear()
})

afterEach(() => {
  cleanup()
})

describe("AdminTransactions", () => {
  it("loads transactions on mount", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    // Should show loading state initially
    expect(screen.getByText("Loading transactions...")).toBeTruthy()

    // Wait for transactions to load
    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Verify API call was made with correct params
    expect(apiRequest).toHaveBeenCalledWith("/api/admin/transactions?page=1", {
      token: "test-token-123",
      signal: expect.any(AbortSignal),
    })
  })

  it("displays transactions in table with correct columns", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Verify table headers
    expect(screen.getByText("User")).toBeTruthy()
    expect(screen.getByText("Description")).toBeTruthy()
    expect(screen.getByText("Category")).toBeTruthy()
    expect(screen.getByText("Type")).toBeTruthy()
    expect(screen.getByText("Amount")).toBeTruthy()
    expect(screen.getByText("Date")).toBeTruthy()
    expect(screen.getByText("Status")).toBeTruthy()
    expect(screen.getByText("Actions")).toBeTruthy()

    // Verify transaction data
    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
    expect(screen.getByText("Salary deposit")).toBeTruthy()
    expect(screen.getByText("Jane Smith")).toBeTruthy()
    expect(screen.getByText("Restaurant")).toBeTruthy()
  })

  it("shows error message when API fails", async () => {
    const errorMessage = "Failed to load transactions from server"
    apiRequest.mockRejectedValueOnce(new Error(errorMessage))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Error loading transactions")).toBeTruthy()
      expect(screen.getByText(errorMessage)).toBeTruthy()
    })

    // Should not show loading state
    expect(screen.queryByText("Loading transactions...")).not.toBeTruthy()

    // Should show empty state
    expect(
      screen.getByText("No transactions match these filters."),
    ).toBeTruthy()
  })

  it("shows empty state when no transactions match filters", async () => {
    apiRequest.mockResolvedValueOnce({
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(
        screen.getByText("No transactions match these filters."),
      ).toBeTruthy()
    })

    expect(screen.queryByText("Grocery store")).not.toBeTruthy()
  })

  it("filters transactions by type (income)", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Filter by income type
    apiRequest.mockResolvedValueOnce({
      data: [mockTransactions[1]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    })

    const typeSelect = screen.getByLabelText("Filter by transaction type")
    fireEvent.change(typeSelect, { target: { value: "income" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=1&type=income",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Salary deposit")).toBeTruthy()
      expect(screen.queryByText("Grocery store")).not.toBeTruthy()
    })
  })

  it("filters transactions by type (expense)", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Filter by expense type
    apiRequest.mockResolvedValueOnce({
      data: [mockTransactions[0], mockTransactions[2]],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        pages: 1,
      },
    })

    const typeSelect = screen.getByLabelText("Filter by transaction type")
    fireEvent.change(typeSelect, { target: { value: "expense" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=1&type=expense",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
      expect(screen.getByText("Restaurant")).toBeTruthy()
      expect(screen.queryByText("Salary deposit")).not.toBeTruthy()
    })
  })

  it("filters transactions by status", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Filter by pending status
    apiRequest.mockResolvedValueOnce({
      data: [mockTransactions[2]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    })

    const statusSelect = screen.getByLabelText("Filter by transaction status")
    fireEvent.change(statusSelect, { target: { value: "pending" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=1&status=pending",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Restaurant")).toBeTruthy()
      expect(screen.queryByText("Grocery store")).not.toBeTruthy()
    })
  })

  it("searches transactions by category", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Search for 'Salary' category
    apiRequest.mockResolvedValueOnce({
      data: [mockTransactions[1]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    })

    const searchInput = screen.getByPlaceholderText("Search by category...")
    fireEvent.change(searchInput, { target: { value: "Salary" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=1&category=Salary",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Salary deposit")).toBeTruthy()
      expect(screen.queryByText("Grocery store")).not.toBeTruthy()
    })
  })

  it("paginates to next page", async () => {
    const page1Transactions = [mockTransactions[0], mockTransactions[1]]

    apiRequest.mockResolvedValueOnce({
      data: page1Transactions,
      pagination: {
        page: 1,
        limit: 2,
        total: 4,
        pages: 2,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Verify page 2 button is rendered
    expect(screen.getByLabelText("Go to page 2")).toBeTruthy()

    apiRequest.mockClear()

    // Mock page 2 response
    const page2Transactions = [mockTransactions[2]]
    apiRequest.mockResolvedValueOnce({
      data: page2Transactions,
      pagination: {
        page: 2,
        limit: 2,
        total: 4,
        pages: 2,
      },
    })

    // Click page 2 button
    fireEvent.click(screen.getByLabelText("Go to page 2"))

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=2",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Restaurant")).toBeTruthy()
      expect(screen.queryByText("Grocery store")).not.toBeTruthy()
    })
  })

  it("resets to page 1 when filter changes", async () => {
    const mockPage1 = {
      data: mockTransactions.slice(0, 2),
      pagination: {
        page: 1,
        limit: 2,
        total: 4,
        pages: 2,
      },
    }

    apiRequest.mockResolvedValueOnce(mockPage1)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Mock page 2 response
    const mockPage2 = {
      data: [mockTransactions[2]],
      pagination: {
        page: 2,
        limit: 2,
        total: 4,
        pages: 2,
      },
    }
    apiRequest.mockResolvedValueOnce(mockPage2)

    // Go to page 2
    fireEvent.click(screen.getByLabelText("Go to page 2"))

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=2",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })

    apiRequest.mockClear()

    // Mock filtered page 1 response
    const mockFilteredPage1 = {
      data: [mockTransactions[1]],
      pagination: {
        page: 1,
        limit: 2,
        total: 1,
        pages: 1,
      },
    }
    apiRequest.mockResolvedValueOnce(mockFilteredPage1)

    // Apply a filter (type)
    const typeSelect = screen.getByLabelText("Filter by transaction type")
    fireEvent.change(typeSelect, { target: { value: "income" } })

    // Should reset to page 1 when filter changes
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/transactions?page=1&type=income",
        {
          token: "test-token-123",
          signal: expect.any(AbortSignal),
        },
      )
    })
  })

  it("displays pagination info correctly", async () => {
    apiRequest.mockResolvedValueOnce({
      data: mockTransactions.slice(0, 2),
      pagination: {
        page: 1,
        limit: 2,
        total: 5,
        pages: 3,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Check pagination summary
    expect(screen.getByText("Showing 1–2 of 5")).toBeTruthy()
  })

  it("displays transaction amounts with correct formatting", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Check formatted amounts
    expect(screen.getByText("−€50.25")).toBeTruthy() // Expense with minus sign
    expect(screen.getByText("+€2000.00")).toBeTruthy() // Income with plus sign
    expect(screen.getByText("−€30.50")).toBeTruthy() // Another expense
  })

  it("displays user names from nested userId structure", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Verify user names are correctly extracted from userId.id structure
    expect(screen.getAllByText("John Doe").length).toBeGreaterThan(0)
    expect(screen.getByText("Jane Smith")).toBeTruthy()
  })

  it("displays transaction type and status badges", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    // Check for type badges
    expect(screen.getAllByText("expense").length).toBeGreaterThan(0)
    expect(screen.getAllByText("income").length).toBeGreaterThan(0)

    // Check for status badges
    expect(screen.getAllByText("completed").length).toBeGreaterThan(0)
    expect(screen.getAllByText("pending").length).toBeGreaterThan(0)
  })

  it("prevents stale responses after filter change", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Grocery store")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Start a slow API call for type=income
    apiRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                data: [mockTransactions[1]],
                pagination: {
                  page: 1,
                  limit: 20,
                  total: 1,
                  pages: 1,
                },
              }),
            200,
          )
        }),
    )

    const typeSelect = screen.getByLabelText("Filter by transaction type")
    fireEvent.change(typeSelect, { target: { value: "income" } })

    // Immediately change filter again (to status=pending)
    apiRequest.mockClear()
    apiRequest.mockResolvedValueOnce({
      data: [mockTransactions[2]],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      },
    })

    const statusSelect = screen.getByLabelText("Filter by transaction status")
    fireEvent.change(statusSelect, { target: { value: "pending" } })

    // Verify that only the most recent request is processed
    await waitFor(() => {
      expect(screen.getByText("Restaurant")).toBeTruthy()
    })

    // Should have only 1 API call (the most recent one)
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })
})
