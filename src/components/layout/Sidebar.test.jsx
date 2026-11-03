import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@testing-library/react"

import { MemoryRouter } from "react-router-dom"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__sidebarTestAuth,
}))

vi.mock("@/contexts/NotificationContext", () => ({
  useNotifications: () => ({ unreadCount: window.__sidebarUnreadCount }),
}))

import Sidebar from "@/components/layout/Sidebar"

const clientNavigation = [
  { name: "Dashboard", icon: "grid", path: "/client/dashboard" },

  { name: "Notifications", icon: "bell", path: "/client/notifications" },
]

function renderSidebar(role = "client") {
  return render(
    <MemoryRouter initialEntries={["/client/dashboard"]}>
      <Sidebar navItems={clientNavigation} role={role} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()

  delete window.__sidebarTestAuth

  delete window.__sidebarUnreadCount
})

describe("Sidebar notification badge", () => {
  it("does not show a badge when the unread count is zero", () => {
    window.__sidebarUnreadCount = 0

    window.__sidebarTestAuth = { user: { role: "client" }, logout: vi.fn() }

    renderSidebar()

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    })

    const notificationsLink = within(navigation).getByRole("link", {
      name: "Notifications",
    })

    expect(notificationsLink.querySelector("span")).toBeNull()
  })

  it.each([1, 99])(
    "shows the unread count %s next to Notifications",
    (count) => {
      window.__sidebarUnreadCount = count
      window.__sidebarTestAuth = { user: { role: "client" }, logout: vi.fn() }

      renderSidebar()

      const navigation = screen.getByRole("navigation", {
        name: "Main navigation",
      })
      const notificationsLink = within(navigation).getByRole("link", {
        name: `Notifications ${count}`,
      })
      expect(within(notificationsLink).getByText(String(count))).toBeTruthy()
    },
  )

  it("caps counts above 99 at 99+", () => {
    window.__sidebarUnreadCount = 100

    window.__sidebarTestAuth = { user: { role: "client" }, logout: vi.fn() }

    renderSidebar()

    const navigation = screen.getByRole("navigation", {
      name: "Main navigation",
    })

    const notificationsLink = within(navigation).getByRole("link", {
      name: "Notifications 99+",
    })

    expect(within(notificationsLink).getByText("99+")).toBeTruthy()
  })

  it("does not require a notification provider for the admin navigation", () => {
    window.__sidebarTestAuth = { user: { role: "admin" }, logout: vi.fn() }

    renderSidebar("admin")

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeTruthy()
  })
})
