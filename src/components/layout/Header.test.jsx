import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { MemoryRouter, Route, Routes } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__headerTestAuth,
}))

vi.mock("@/contexts/NotificationContext", () => ({
  useNotifications: () => ({ unreadCount: window.__headerUnreadCount }),
}))

import Header from "@/components/layout/Header"

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={["/client/dashboard"]}>
      <Header role="client" />
      <Routes>
        <Route path="/client/dashboard" element={<p>Dashboard</p>} />
        <Route
          path="/client/notifications"
          element={<p>Notifications destination</p>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()

  delete window.__headerTestAuth

  delete window.__headerUnreadCount
})

describe("Header notification badge", () => {
  it.each([
    [0, null],

    [1, "1"],

    [99, "99"],

    [100, "99+"],
  ])("shows %s unread notifications as %s", (unreadCount, badgeText) => {
    window.__headerUnreadCount = unreadCount

    window.__headerTestAuth = {
      user: { role: "client", firstName: "Test", lastName: "User" },
    }

    renderHeader()

    const notificationsLink = screen.getByRole("link", {
      name: "Notifications",
    })

    expect(notificationsLink.getAttribute("href")).toBe("/client/notifications")

    if (badgeText) {
      expect(screen.getByText(badgeText)).toBeTruthy()
    } else {
      expect(notificationsLink.querySelector("span")).toBeNull()
    }
  })

  it("navigates to the Notifications page when the bell is selected", () => {
    window.__headerUnreadCount = 0

    window.__headerTestAuth = {
      user: { role: "client", firstName: "Test", lastName: "User" },
    }

    renderHeader()

    fireEvent.click(screen.getByRole("link", { name: "Notifications" }))

    expect(screen.getByText("Notifications destination")).toBeTruthy()
  })
})
