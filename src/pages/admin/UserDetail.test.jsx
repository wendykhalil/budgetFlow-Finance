import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import { MemoryRouter, Route, Routes } from "react-router-dom"

import { AdminUserDetail } from "./UserDetail"

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

const userRecord = {
  id: "client-42",

  firstName: "Casey",

  lastName: "Jones",

  email: "casey@example.test",

  phone: "+33123456789",

  country: "France",

  currency: "EUR",

  role: "client",

  status: "active",

  createdAt: "2026-03-12T10:30:00.000Z",
}

function deferred() {
  let resolve

  const promise = new Promise((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/users/client-42"]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserDetail />} />
      </Routes>
    </MemoryRouter>,
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

describe("AdminUserDetail", () => {
  it("loads the selected user from the authenticated admin detail API", async () => {
    apiRequest.mockResolvedValue({ user: userRecord })

    renderPage()

    expect(screen.getByText("Loading user details…")).toBeTruthy()

    expect(
      (await screen.findAllByText("casey@example.test")).length,
    ).toBeGreaterThan(0)

    expect(screen.getByText("France")).toBeTruthy()

    expect(screen.getByText("EUR")).toBeTruthy()

    expect(screen.getByText("12/03/2026")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledWith("admin/users/client-42", {
      token: "admin-token-a",

      signal: expect.any(AbortSignal),
    })
  })

  it("does not present mock activity metrics as persisted user data", async () => {
    apiRequest.mockResolvedValue({ user: userRecord })

    renderPage()

    await screen.findAllByText("casey@example.test")

    expect(screen.getByText("Activity summary unavailable")).toBeTruthy()

    expect(
      screen.getByText(
        /does not include per-user transaction or budget summaries/i,
      ),
    ).toBeTruthy()

    expect(screen.queryByText("Savings rate")).toBeNull()

    expect(
      screen.getByRole("button", { name: "Delete unavailable" }),
    ).toBeTruthy()
  })

  it("updates account status through the existing API", async () => {
    apiRequest.mockImplementation((endpoint, options) => {
      if (options.method === "PATCH") {
        return Promise.resolve({
          user: { ...userRecord, status: options.body.status },
        })
      }

      return Promise.resolve({ user: userRecord })
    })

    renderPage()

    await screen.findAllByText("casey@example.test")

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "admin/users/client-42/status",

        {
          token: "admin-token-a",

          method: "PATCH",

          body: { status: "suspended" },

          signal: expect.any(AbortSignal),
        },
      ),
    )

    expect(
      await screen.findByRole("button", { name: "Reactivate" }),
    ).toBeTruthy()
  })

  it("shows API errors instead of a mock user when the user is missing", async () => {
    const error = new Error("User not found.")

    error.status = 404

    apiRequest.mockRejectedValue(error)

    renderPage()

    expect(await screen.findByText("User not found.")).toBeTruthy()

    expect(screen.queryByText("casey@example.test")).toBeNull()
  })

  it("aborts and ignores a detail response from a previous admin session", async () => {
    const pending = []

    apiRequest.mockImplementation((endpoint, options) => {
      const request = deferred()

      pending.push({ endpoint, options, ...request })

      return request.promise
    })

    const { rerender } = renderPage()

    await waitFor(() => expect(pending).toHaveLength(1))

    authSession.current = {
      user: { id: "admin-b", role: "admin" },

      token: "admin-token-b",
    }

    rerender(
      <MemoryRouter initialEntries={["/admin/users/client-42"]}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(pending).toHaveLength(2))

    expect(pending[0].options.signal.aborted).toBe(true)

    pending[0].resolve({
      user: { ...userRecord, firstName: "Stale", email: "stale@example.test" },
    })

    pending[1].resolve({ user: userRecord })

    expect(
      (await screen.findAllByText("casey@example.test")).length,
    ).toBeGreaterThan(0)

    expect(screen.queryByText("stale@example.test")).toBeNull()

    expect(apiRequest).toHaveBeenLastCalledWith("admin/users/client-42", {
      token: "admin-token-b",

      signal: expect.any(AbortSignal),
    })
  })
})
