import { fireEvent, render, screen } from "@testing-library/react"

import { describe, expect, it, vi } from "vitest"

import ClientCalendar from "@/pages/client/Calendar"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "usr_001", currency: "EUR" } }),
}))

describe("ClientCalendar calendar-date handling", () => {
  it("places transactions on the exact stored YYYY-MM-DD calendar day", () => {
    render(<ClientCalendar />)

    expect(screen.getByText("Grocery Store")).toBeTruthy()

    fireEvent.click(
      screen.getByRole("button", { name: /Monday, 5 October 2026/i }),
    )

    expect(screen.getByText("5 October 2026")).toBeTruthy()

    expect(
      screen.getByText("Salary", { selector: ".font-semibold" }),
    ).toBeTruthy()

    expect(screen.queryByText("Grocery Store")).toBeNull()
  })
})
