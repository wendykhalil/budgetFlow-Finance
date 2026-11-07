import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }))

import { useAuth } from "@/contexts/AuthContext"

import Login from "@/pages/auth/Login"

const login = vi.fn()

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/forgot-password"
          element={<span>Reset password page</span>}
        />
        <Route path="/register" element={<span>Registration page</span>} />
        <Route path="/client/dashboard" element={<span>Dashboard page</span>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  login.mockReset()

  useAuth.mockReturnValue({ login, authError: "" })
})

describe("Login", () => {
  it("links to the existing password recovery and account creation routes", () => {
    renderLogin()

    expect(
      screen
        .getByRole("link", { name: "Forgot password?" })
        .getAttribute("href"),
    )

      .toBe("/forgot-password")

    expect(
      screen.getByRole("link", { name: "Create account" }).getAttribute("href"),
    )

      .toBe("/register")

    fireEvent.click(screen.getByRole("link", { name: "Forgot password?" }))

    expect(screen.getByText("Reset password page")).toBeTruthy()
  })

  it("submits credentials through AuthContext and navigates to the dashboard", async () => {
    login.mockResolvedValue({ user: { role: "client" } })

    renderLogin()

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.test" },
    })

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("alex@example.test", "secret123"),
    )

    expect(await screen.findByText("Dashboard page")).toBeTruthy()
  })

  it("shows a friendly message when the login request times out", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    login.mockRejectedValue(new Error("Request timed out after 15000 ms."))

    renderLogin()

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.test" },
    })

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText(
        "We couldn't sign you in. Please try again in a moment.",
      ),
    ).toBeTruthy()

    expect(screen.queryByText("Request timed out after 15000 ms.")).toBeNull()

    if (import.meta.env.DEV) {
      expect(consoleError).toHaveBeenCalledWith(
        "Login request failed:",

        expect.any(Error),
      )
    }
  })
})
