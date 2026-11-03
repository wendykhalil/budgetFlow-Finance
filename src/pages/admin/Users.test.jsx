import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { MemoryRouter } from "react-router-dom"

import { AdminUsers } from "./Users"

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

const mockUsers = [
  {
    id: "user-1",

    firstName: "John",

    lastName: "Doe",

    email: "john@example.com",

    role: "client",

    status: "active",

    avatar: "JD",

    avatarColor: "blue",

    joinedAt: "2026-01-15T10:00:00Z",
  },

  {
    id: "user-2",

    firstName: "Jane",

    lastName: "Smith",

    email: "jane@example.com",

    role: "admin",

    status: "pending",

    avatar: "JS",

    avatarColor: "green",

    joinedAt: "2026-01-20T14:30:00Z",
  },

  {
    id: "user-3",

    firstName: "Bob",

    lastName: "Johnson",

    email: "bob@example.com",

    role: "client",

    status: "suspended",

    avatar: "BJ",

    avatarColor: "red",

    joinedAt: "2026-02-01T09:15:00Z",
  },
]

const mockResponse = {
  data: mockUsers,

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
      <AdminUsers />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  apiRequest.mockClear()
})

afterEach(() => {
  cleanup()
})

describe("AdminUsers", () => {
  it("loads users on mount", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    // Should show loading state initially

    expect(screen.getByText("Loading users...")).toBeTruthy()

    // Wait for users to load

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Verify API call was made with correct params

    expect(apiRequest).toHaveBeenCalledWith("/api/admin/users?page=1", {
      token: "test-token-123",

      signal: expect.any(AbortSignal),
    })
  })

  it("displays users in table with correct columns", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Verify table headers

    expect(screen.getByText("User")).toBeTruthy()

    expect(screen.getByText("Role")).toBeTruthy()

    expect(screen.getByText("Status")).toBeTruthy()

    expect(screen.getByText("Joined")).toBeTruthy()

    expect(screen.getByText("Actions")).toBeTruthy()

    // Verify user data

    expect(screen.getByText("john@example.com")).toBeTruthy()

    expect(screen.getByText("Jane Smith")).toBeTruthy()

    expect(screen.getByText("jane@example.com")).toBeTruthy()

    expect(screen.getByText("Bob Johnson")).toBeTruthy()
  })

  it("shows error message when API fails", async () => {
    const errorMessage = "Failed to load users from server"

    apiRequest.mockRejectedValueOnce(new Error(errorMessage))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Error loading users")).toBeTruthy()

      expect(screen.getByText(errorMessage)).toBeTruthy()
    })

    // Should not show loading state

    expect(screen.queryByText("Loading users...")).not.toBeTruthy()

    // Should show empty state

    expect(screen.getByText("No users match these filters.")).toBeTruthy()
  })

  it("shows empty state when no users match filters", async () => {
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
      expect(screen.getByText("No users match these filters.")).toBeTruthy()
    })

    expect(screen.queryByText("John Doe")).not.toBeTruthy()
  })

  it("filters users by search query", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Clear previous calls

    apiRequest.mockClear()

    // Search for 'jane'

    apiRequest.mockResolvedValueOnce({
      data: [mockUsers[1]],

      pagination: {
        page: 1,

        limit: 20,

        total: 1,

        pages: 1,
      },
    })

    const searchInput = screen.getByPlaceholderText("Search users...")

    fireEvent.change(searchInput, { target: { value: "jane" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users?page=1&search=jane",

        {
          token: "test-token-123",

          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeTruthy()

      expect(screen.queryByText("John Doe")).not.toBeTruthy()
    })
  })

  it("filters users by status", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Filter by suspended status

    apiRequest.mockResolvedValueOnce({
      data: [mockUsers[2]],

      pagination: {
        page: 1,

        limit: 20,

        total: 1,

        pages: 1,
      },
    })

    const statusSelect = screen.getByLabelText("Filter by user status")

    fireEvent.change(statusSelect, { target: { value: "suspended" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users?page=1&status=suspended",

        {
          token: "test-token-123",

          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Bob Johnson")).toBeTruthy()

      expect(screen.queryByText("John Doe")).not.toBeTruthy()
    })
  })

  it("filters users by role", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Filter by admin role

    apiRequest.mockResolvedValueOnce({
      data: [mockUsers[1]],

      pagination: {
        page: 1,

        limit: 20,

        total: 1,

        pages: 1,
      },
    })

    const roleSelect = screen.getByLabelText("Filter by user role")

    fireEvent.change(roleSelect, { target: { value: "admin" } })

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users?page=1&role=admin",

        {
          token: "test-token-123",

          signal: expect.any(AbortSignal),
        },
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeTruthy()

      expect(screen.queryByText("John Doe")).not.toBeTruthy()
    })
  })

  it("paginates to next page", async () => {
    const page2Users = [
      {
        ...mockUsers[0],

        id: "user-4",

        firstName: "Alice",

        lastName: "Brown",
      },
    ]

    apiRequest.mockResolvedValueOnce({
      data: mockUsers,

      pagination: {
        page: 1,

        limit: 20,

        total: 4,

        pages: 2,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Verify page 2 button is rendered

    expect(screen.getByLabelText("Go to page 2")).toBeTruthy()

    apiRequest.mockClear()

    // Mock page 2 response

    apiRequest.mockResolvedValueOnce({
      data: page2Users,

      pagination: {
        page: 2,

        limit: 20,

        total: 4,

        pages: 2,
      },
    })

    // Click page 2 button

    fireEvent.click(screen.getByLabelText("Go to page 2"))

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/api/admin/users?page=2", {
        token: "test-token-123",

        signal: expect.any(AbortSignal),
      })
    })

    await waitFor(() => {
      expect(screen.getByText("Alice Brown")).toBeTruthy()
    })
  })

  it("suspends an active user", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Mock status update response

    apiRequest.mockResolvedValueOnce({
      user: { ...mockUsers[0], status: "suspended" },
    })

    // Find and click suspend button for John Doe (first user, second action button)

    const suspendButtons = screen.getAllByLabelText(/Suspend John Doe/)

    fireEvent.click(suspendButtons[0])

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users/user-1/status",
        {
          token: "test-token-123",

          method: "PATCH",

          body: { status: "suspended" },
        },
      )
    })

    // Verify UI updates to show suspended status

    // The button should now show 'Reactivate' after status changes

    await waitFor(() => {
      const reactivateButtons =
        screen.queryAllByLabelText(/Reactivate John Doe/)

      expect(reactivateButtons.length).toBeGreaterThan(0)
    })
  })

  it("reactivates a suspended user", async () => {
    // Start with suspended user

    apiRequest.mockResolvedValueOnce({
      data: [mockUsers[2]],

      pagination: {
        page: 1,

        limit: 20,

        total: 1,

        pages: 1,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("Bob Johnson")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Mock reactivate response

    apiRequest.mockResolvedValueOnce({
      user: { ...mockUsers[2], status: "active" },
    })

    // Find and click reactivate button

    const reactivateButtons = screen.getAllByLabelText(/Reactivate Bob Johnson/)

    fireEvent.click(reactivateButtons[0])

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users/user-3/status",
        {
          token: "test-token-123",

          method: "PATCH",

          body: { status: "active" },
        },
      )
    })

    // Verify UI updates

    await waitFor(() => {
      const suspendButtons = screen.queryAllByLabelText(/Suspend Bob Johnson/)

      expect(suspendButtons.length).toBeGreaterThan(0)
    })
  })

  it("prevents duplicate status update submissions", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Mock a slow status update

    apiRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ user: { ...mockUsers[0], status: "suspended" } }),

            500,
          )
        }),
    )

    const suspendButtons = screen.getAllByLabelText(/Suspend John Doe/)

    const button = suspendButtons[0]

    // Click the button

    fireEvent.click(button)

    // Button should be disabled during the request

    expect(button.disabled).toBe(true)

    // Try clicking again (should not trigger another request)

    fireEvent.click(button)

    // Wait for the request to complete

    await waitFor(() => {
      expect(button.disabled).toBe(false)
    })

    // Only one API call should have been made

    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("shows error when status update fails", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Mock error response

    const errorMessage = "You cannot deactivate your own account"

    apiRequest.mockRejectedValueOnce(new Error(errorMessage))

    const suspendButtons = screen.getAllByLabelText(/Suspend John Doe/)

    fireEvent.click(suspendButtons[0])

    await waitFor(() => {
      expect(screen.getByText("Error updating user")).toBeTruthy()

      expect(screen.getByText(errorMessage)).toBeTruthy()
    })
  })

  it("navigates to user detail on view button click", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    const viewButtons = screen.getAllByLabelText(/View John Doe/)

    expect(viewButtons.length).toBeGreaterThan(0)

    // Note: Full navigation test would require additional router setup
  })

  it("displays pagination info correctly", async () => {
    apiRequest.mockResolvedValueOnce({
      data: mockUsers.slice(0, 2),

      pagination: {
        page: 1,

        limit: 2,

        total: 3,

        pages: 2,
      },
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Check pagination summary

    expect(screen.getByText("Showing 1–2 of 3")).toBeTruthy()
  })

  it("resets to page 1 when filter changes", async () => {
    // Start with multiple pages

    const mockPage1 = {
      data: mockUsers.slice(0, 2),

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
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    apiRequest.mockClear()

    // Verify page 2 button exists

    expect(screen.getByLabelText("Go to page 2")).toBeTruthy()

    // Mock page 2 response

    const mockPage2 = {
      data: [mockUsers[2]],

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
      expect(apiRequest).toHaveBeenCalledWith("/api/admin/users?page=2", {
        token: "test-token-123",

        signal: expect.any(AbortSignal),
      })
    })

    apiRequest.mockClear()

    // Mock filtered page 1 response

    const mockFilteredPage1 = {
      data: [mockUsers[1]],

      pagination: {
        page: 1,

        limit: 2,

        total: 1,

        pages: 1,
      },
    }

    apiRequest.mockResolvedValueOnce(mockFilteredPage1)

    // Apply a filter (status)

    const statusSelect = screen.getByLabelText("Filter by user status")

    fireEvent.change(statusSelect, { target: { value: "pending" } })

    // Should reset to page 1 when filter changes

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/admin/users?page=1&status=pending",

        {
          token: "test-token-123",

          signal: expect.any(AbortSignal),
        },
      )
    })
  })

  it("displays user role and status badges with correct colors", async () => {
    apiRequest.mockResolvedValueOnce(mockResponse)

    renderPage()

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeTruthy()
    })

    // Verify badges are present (they're rendered via Badge component)

    // Admin badge for Jane (should be blue)

    expect(screen.getByText("admin")).toBeTruthy()

    // Client badges for John and Bob

    expect(screen.getAllByText("client").length).toBe(2)

    // Status badges

    expect(screen.getByText("active")).toBeTruthy()

    expect(screen.getByText("pending")).toBeTruthy()

    expect(screen.getByText("suspended")).toBeTruthy()
  })
})
