import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useState } from "react"

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => window.__categoryTestAuth,
}))

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),

  getSocketBaseUrl: () => "http://localhost:5000",
}))

vi.mock("socket.io-client", () => ({ io: vi.fn() }))

import { apiRequest } from "@/lib/api"

import { io } from "socket.io-client"

import { CategoryProvider, useCategories } from "@/contexts/CategoryContext"

const firstCategory = {
  id: "category-1",

  name: "Food",

  type: "expense",

  color: "#4E9B8D",

  isArchived: false,
}

let socket

function createSocket() {
  const handlers = new Map()

  return {
    handlers,

    on: vi.fn((event, callback) => {
      handlers.set(event, callback)

      return socket
    }),

    off: vi.fn((event, callback) => {
      if (handlers.get(event) === callback) handlers.delete(event)

      return socket
    }),

    connect: vi.fn(),

    disconnect: vi.fn(),
  }
}

function CategoryConsumer() {
  const {
    categories,

    loading,

    error,

    refreshCategories,

    createCategory,

    updateCategory,

    deleteCategory,
  } = useCategories()

  const [mutationError, setMutationError] = useState("")

  function runMutation(mutation) {
    setMutationError("")

    mutation().catch((requestError) => setMutationError(requestError.message))
  }

  return (
    <div>
      <span>{loading ? "Loading categories" : "Categories loaded"}</span>
      {error && <span role="alert">{error}</span>}
      {mutationError && <span role="alert">{mutationError}</span>}
      <ul>
        {categories.map((category) => (
          <li key={category.id}>{category.name}</li>
        ))}
      </ul>
      <button
        onClick={() =>
          runMutation(() => createCategory({ name: "Travel", type: "expense" }))
        }
      >
        Create
      </button>
      <button
        onClick={() =>
          runMutation(() => updateCategory("category-1", { name: "Groceries" }))
        }
      >
        Update
      </button>
      <button onClick={() => runMutation(() => deleteCategory("category-1"))}>
        Delete
      </button>
      <button onClick={() => refreshCategories()}>Refresh</button>
    </div>
  )
}

function renderCategoryProvider() {
  return render(
    <CategoryProvider>
      <CategoryConsumer />
    </CategoryProvider>,
  )
}

function deferred() {
  let resolve

  let reject

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise

    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

beforeEach(() => {
  socket = createSocket()

  io.mockReturnValue(socket)

  window.__categoryTestAuth = {
    user: { id: "user-1", role: "client" },
  }

  localStorage.setItem("budgetflow_token", "token-1")

  apiRequest.mockReset()

  apiRequest.mockResolvedValue({ categories: [] })
})

afterEach(() => {
  cleanup()

  delete window.__categoryTestAuth

  vi.clearAllMocks()
})

describe("CategoryContext", () => {
  it("loads categories from the authenticated Categories API", async () => {
    apiRequest.mockResolvedValueOnce({ categories: [firstCategory] })

    renderCategoryProvider()

    expect(screen.getByText("Loading categories")).toBeTruthy()

    expect(await screen.findByText("Food")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledTimes(1)

    expect(apiRequest).toHaveBeenCalledWith("categories", { token: "token-1" })

    expect(screen.getByText("Categories loaded")).toBeTruthy()
  })

  it("does not refetch when the provider rerenders within the same session", async () => {
    const view = renderCategoryProvider()

    await screen.findByText("Categories loaded")

    view.rerender(
      <CategoryProvider>
        <CategoryConsumer />
      </CategoryProvider>,
    )

    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("exposes loading and API error states", async () => {
    const request = deferred()

    apiRequest.mockReturnValueOnce(request.promise)

    renderCategoryProvider()

    expect(screen.getByText("Loading categories")).toBeTruthy()

    await act(async () => request.reject(new Error("Categories unavailable")))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Categories unavailable",
    )

    expect(screen.getByText("Categories loaded")).toBeTruthy()
  })

  it("does not request categories without an authenticated token", async () => {
    localStorage.removeItem("budgetflow_token")

    renderCategoryProvider()

    expect(screen.getByText("Categories loaded")).toBeTruthy()

    expect(apiRequest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("Refresh"))

    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("does not request categories for an unauthenticated user", () => {
    window.__categoryTestAuth = { user: null }

    renderCategoryProvider()

    expect(screen.getByText("Categories loaded")).toBeTruthy()

    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("creates a category in shared state using the API response", async () => {
    apiRequest

      .mockResolvedValueOnce({ categories: [firstCategory] })

      .mockResolvedValueOnce({
        category: {
          id: "category-2",
          name: "Travel",
          type: "expense",
          isArchived: false,
        },
      })

    renderCategoryProvider()

    await screen.findByText("Food")

    fireEvent.click(screen.getByText("Create"))

    expect(await screen.findByText("Travel")).toBeTruthy()

    expect(apiRequest).toHaveBeenLastCalledWith("categories", {
      method: "POST",

      token: "token-1",

      body: { name: "Travel", type: "expense" },
    })
  })

  it("updates from category-created events without adding duplicate entries", async () => {
    renderCategoryProvider()

    await screen.findByText("Categories loaded")

    const remoteCategory = {
      id: "remote-category",

      name: "Remote",

      type: "income",

      isArchived: false,
    }

    await act(async () => {
      socket.handlers.get("category:created")?.({ category: remoteCategory })

      socket.handlers.get("category:created")?.({ category: remoteCategory })
    })

    expect(screen.getAllByText("Remote")).toHaveLength(1)
  })

  it("refreshes categories after a Socket.IO connection or reconnect", async () => {
    apiRequest.mockResolvedValueOnce({ categories: [] }).mockResolvedValueOnce({
      categories: [
        { ...firstCategory, id: "after-reconnect", name: "Refreshed" },
      ],
    })

    renderCategoryProvider()

    await screen.findByText("Categories loaded")

    await act(async () => socket.handlers.get("connect")?.())

    expect(await screen.findByText("Refreshed")).toBeTruthy()

    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it("removes socket listeners and disconnects on cleanup", async () => {
    const view = renderCategoryProvider()

    await screen.findByText("Categories loaded")

    const connectListener = socket.handlers.get("connect")

    const categoryListener = socket.handlers.get("category:created")

    view.unmount()

    expect(socket.off).toHaveBeenCalledWith("connect", connectListener)

    expect(socket.off).toHaveBeenCalledWith(
      "category:created",
      categoryListener,
    )

    expect(socket.disconnect).toHaveBeenCalledOnce()
  })

  it("keeps a successful mutation when an earlier list request finishes afterward", async () => {
    const listRequest = deferred()

    apiRequest

      .mockReturnValueOnce(listRequest.promise)

      .mockResolvedValueOnce({
        category: {
          id: "category-2",
          name: "Travel",
          type: "expense",
          isArchived: false,
        },
      })

    renderCategoryProvider()

    fireEvent.click(screen.getByText("Create"))

    expect(await screen.findByText("Travel")).toBeTruthy()

    await act(async () => listRequest.resolve({ categories: [] }))

    expect(screen.getByText("Travel")).toBeTruthy()
  })

  it("updates the matching category and retains other categories", async () => {
    const otherCategory = {
      ...firstCategory,
      id: "category-2",
      name: "Housing",
    }

    apiRequest

      .mockResolvedValueOnce({ categories: [firstCategory, otherCategory] })

      .mockResolvedValueOnce({
        category: { ...firstCategory, name: "Groceries" },
      })

    renderCategoryProvider()

    await screen.findByText("Food")

    fireEvent.click(screen.getByText("Update"))

    expect(await screen.findByText("Groceries")).toBeTruthy()

    expect(screen.getByText("Housing")).toBeTruthy()

    expect(screen.queryByText("Food")).toBeNull()
  })

  it("removes a category from active state after archive or delete success", async () => {
    apiRequest

      .mockResolvedValueOnce({ categories: [firstCategory] })

      .mockResolvedValueOnce({
        action: "archived",
        category: { ...firstCategory, isArchived: true },
      })

    renderCategoryProvider()

    await screen.findByText("Food")

    fireEvent.click(screen.getByText("Delete"))

    await waitFor(() => expect(screen.queryByText("Food")).toBeNull())

    expect(apiRequest).toHaveBeenLastCalledWith("categories/category-1", {
      method: "DELETE",

      token: "token-1",
    })
  })

  it("clears categories when the user logs out", async () => {
    apiRequest.mockResolvedValueOnce({ categories: [firstCategory] })

    const view = renderCategoryProvider()

    await screen.findByText("Food")

    window.__categoryTestAuth = { user: null }

    localStorage.removeItem("budgetflow_token")

    view.rerender(
      <CategoryProvider>
        <CategoryConsumer />
      </CategoryProvider>,
    )

    expect(screen.queryByText("Food")).toBeNull()

    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("clears previous categories and ignores stale responses after a user switch", async () => {
    const previousRequest = deferred()

    const currentRequest = deferred()

    apiRequest

      .mockReturnValueOnce(previousRequest.promise)

      .mockReturnValueOnce(currentRequest.promise)

    const view = renderCategoryProvider()

    expect(screen.getByText("Loading categories")).toBeTruthy()

    window.__categoryTestAuth = {
      user: { id: "user-2", role: "client" },
    }

    localStorage.setItem("budgetflow_token", "token-2")

    view.rerender(
      <CategoryProvider>
        <CategoryConsumer />
      </CategoryProvider>,
    )

    await act(async () =>
      currentRequest.resolve({
        categories: [
          { ...firstCategory, id: "new-category", name: "New user category" },
        ],
      }),
    )

    expect(await screen.findByText("New user category")).toBeTruthy()

    await act(async () =>
      previousRequest.resolve({ categories: [firstCategory] }),
    )

    expect(screen.getByText("New user category")).toBeTruthy()

    expect(screen.queryByText("Food")).toBeNull()

    expect(apiRequest).toHaveBeenNthCalledWith(1, "categories", {
      token: "token-1",
    })

    expect(apiRequest).toHaveBeenNthCalledWith(2, "categories", {
      token: "token-2",
    })
  })

  it("does not change category state when a mutation fails", async () => {
    apiRequest

      .mockResolvedValueOnce({ categories: [firstCategory] })

      .mockRejectedValueOnce(new Error("Create failed"))

    renderCategoryProvider()

    await screen.findByText("Food")

    fireEvent.click(screen.getByText("Create"))

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Create failed",
    )

    expect(screen.getByText("Food")).toBeTruthy()

    expect(screen.queryByText("Travel")).toBeNull()
  })
})
