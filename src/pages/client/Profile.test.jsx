import { beforeEach, describe, expect, it, vi } from "vitest"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"

vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }))

vi.mock("@/contexts/TransactionContext", () => ({ useTransactions: vi.fn() }))

import { useAuth } from "@/contexts/AuthContext"

import { useTransactions } from "@/contexts/TransactionContext"

import ClientProfile from "@/pages/client/Profile"

const updateCurrency = vi.fn()
const updateProfile = vi.fn()

function renderProfile(transactionState = {}) {
  useAuth.mockReturnValue({
    user: {
      id: "user-1",
      firstName: "Alex",
      lastName: "Martin",
      email: "alex@example.test",
      currency: "EUR",
      phone: "+33123456789",
      country: "France",
    },
    updateProfile,
    updateCurrency,
  })

  useTransactions.mockReturnValue({
    transactions: [],
    loading: false,
    error: "",
    ...transactionState,
  })

  return render(<ClientProfile />)
}

beforeEach(() => {
  updateCurrency.mockReset()
  updateProfile.mockReset()
})

describe("Profile currency preference", () => {
  it("locks the currency selector when transaction history exists", () => {
    renderProfile({ transactions: [{ id: "transaction-1" }] })

    expect(screen.getByLabelText("Account currency").disabled).toBe(true)

    expect(
      screen.getByText(/Locked because this account has transactions/),
    ).toBeTruthy()
  })

  it("persists currency through AuthContext and reports success", async () => {
    updateCurrency.mockResolvedValue({ currency: "USD" })

    renderProfile()

    fireEvent.change(screen.getByLabelText("Account currency"), {
      target: { value: "USD" },
    })

    await waitFor(() => expect(updateCurrency).toHaveBeenCalledWith("USD"))

    expect(await screen.findByText("Account currency updated.")).toBeTruthy()
  })

  it("shows backend rejection without pretending the selection was saved", async () => {
    updateCurrency.mockRejectedValue(
      new Error("Currency cannot be changed after transactions exist."),
    )

    renderProfile()

    const selector = screen.getByLabelText("Account currency")

    fireEvent.change(selector, { target: { value: "USD" } })

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Currency cannot be changed after transactions exist.",
    )

    expect(selector.value).toBe("EUR")

    expect(screen.queryByText("Account currency updated.")).toBeNull()
  })
})

describe("Profile persistence", () => {
  it("calls updateProfile API when save button clicked", async () => {
    updateProfile.mockResolvedValue({ id: "user-1" })

    renderProfile()

    const saveButtons = screen.getAllByText("Save profile")
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        firstName: "Alex",
        lastName: "Martin",
        phone: "+33123456789",
        country: "France",
      })
    })

    expect(
      await screen.findByText("Profile updated successfully."),
    ).toBeTruthy()
  })
})
