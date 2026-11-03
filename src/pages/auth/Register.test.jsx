import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }))

import { useAuth } from "@/contexts/AuthContext"

import Register from "@/pages/auth/Register"

const register = vi.fn()

beforeEach(() => {
  register.mockReset()

  register.mockResolvedValue({
    user: { role: "client" },
  })

  useAuth.mockReturnValue({ register })
})

describe("registration currency selection", () => {
  it("sends the selected account currency to AuthContext", async () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route
            path="/client/dashboard"
            element={<span>Dashboard loaded</span>}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText("Account currency").value).toBe("EUR")

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Alex" },
    })

    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Martin" },
    })

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alex@example.test" },
    })

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Client123!" },
    })

    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Client123!" },
    })

    fireEvent.change(screen.getByLabelText("Account currency"), {
      target: { value: "TND" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "TND" }),
      ),
    )

    expect(await screen.findByText("Dashboard loaded")).toBeTruthy()
  })
})
