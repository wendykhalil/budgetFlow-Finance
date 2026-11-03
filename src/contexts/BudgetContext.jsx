import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { io } from "socket.io-client"

import { useAuth } from "@/contexts/AuthContext"

import { useTransactions } from "@/contexts/TransactionContext"

import { apiRequest, getSocketBaseUrl } from "@/lib/api"

const BudgetContext = createContext(null)
const TOKEN_KEY = "budgetflow_token"

function isCurrentSession(activeSessionRef, sessionKey, token) {
  return Boolean(
    sessionKey &&
      token &&
      activeSessionRef.current === sessionKey &&
      localStorage.getItem(TOKEN_KEY) === token,
  )
}

function sortBudgets(budgets) {
  return [...budgets].sort(
    (left, right) =>
      String(right.startDate || "").localeCompare(
        String(left.startDate || ""),
      ) || String(left.name || "").localeCompare(String(right.name || "")),
  )
}

function budgetsEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((budget, index) => {
      const other = right[index]

      const keys = new Set([...Object.keys(budget), ...Object.keys(other)])

      return [...keys].every((key) => {
        if (key === "categoryId") {
          return (
            JSON.stringify(budget.categoryId) ===
            JSON.stringify(other.categoryId)
          )
        }

        if (key === "spending") {
          return (
            JSON.stringify(budget.spending) === JSON.stringify(other.spending)
          )
        }

        return budget[key] === other[key]
      })
    })
  )
}

function applyBudgetAction(budgets, action) {
  if (action.type === "remove") {
    const updated = budgets.filter((budget) => budget.id !== action.id)

    return updated.length === budgets.length ? budgets : updated
  }

  const index = budgets.findIndex((budget) => budget.id === action.budget.id)

  const budget =
    index === -1 || action.budget.spending
      ? action.budget
      : { ...action.budget, spending: budgets[index].spending }

  if (index !== -1 && budgetsEqual([budgets[index]], [budget])) return budgets

  const updated =
    index === -1
      ? [...budgets, budget]
      : budgets.map((current, itemIndex) =>
          itemIndex === index ? budget : current,
        )

  return sortBudgets(updated)
}

function getCategoryId(category) {
  if (typeof category === "string") return category
  return category?.id || category?._id || ""
}

function getBudgetContributionSignature(transactions, budgets) {
  const budgetMonths = new Set(
    budgets.map(
      (budget) =>
        `${getCategoryId(budget.categoryId)}:${String(budget.startDate || "").slice(0, 7)}`,
    ),
  )

  return JSON.stringify(
    transactions
      .filter((transaction) => {
        if (
          transaction.type !== "expense" ||
          transaction.status !== "completed" ||
          !transaction.id ||
          !transaction.categoryId ||
          typeof transaction.date !== "string"
        ) {
          return false
        }

        return budgetMonths.has(
          `${getCategoryId(transaction.categoryId)}:${transaction.date.slice(0, 7)}`,
        )
      })
      .map((transaction) => [
        transaction.id,
        getCategoryId(transaction.categoryId),
        transaction.date,
        transaction.amount,
      ])
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
  )
}

async function loadBudgetSpending(id, token) {
  const response = await apiRequest(
    `budgets/${encodeURIComponent(id)}/spent`,

    { token },
  )

  if (
    !response ||
    typeof response.spent !== "number" ||
    typeof response.limit !== "number" ||
    typeof response.remaining !== "number" ||
    typeof response.percentUsed !== "number" ||
    typeof response.status !== "string"
  ) {
    throw new Error("The budget spending service returned an invalid response.")
  }

  return response
}

export function BudgetProvider({ children }) {
  const { user } = useAuth()

  const { transactions, loading: transactionsLoading } = useTransactions()

  const userId = user?.role === "client" ? user.id : null

  const token = localStorage.getItem(TOKEN_KEY)

  const sessionKey = userId && token ? `${userId}:${token}` : null

  const [state, setState] = useState({
    sessionKey: null,

    budgets: [],

    loading: false,

    error: "",
  })

  const activeSessionRef = useRef(sessionKey)

  const requestRef = useRef(null)

  const stateRef = useRef(state)

  const spendingRevisionRef = useRef(0)

  const spendingRefreshRef = useRef(null)

  const spendingRefreshRequestedRef = useRef(false)

  const transactionSnapshotRef = useRef(null)

  const sequenceRef = useRef(0)

  const actionsRef = useRef([])
  const previousSessionRef = useRef(sessionKey)

  activeSessionRef.current = sessionKey
  stateRef.current = state

  const refreshBudgets = useCallback(
    (options = {}) => {
      if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
        return Promise.resolve(false)
      }
      if (requestRef.current?.sessionKey === sessionKey) {
        if (options.afterPending) {
          return requestRef.current.promise.then(() =>
            isCurrentSession(activeSessionRef, sessionKey, token)
              ? refreshBudgets()
              : false,
          )
        }
        return requestRef.current.promise
      }

      const requestSequence = sequenceRef.current
      const spendingRevision = spendingRevisionRef.current

      setState((current) => ({
        sessionKey,

        budgets: current.sessionKey === sessionKey ? current.budgets : [],

        loading: true,

        error: "",
      }))

      const request = apiRequest("budgets", { token })

        .then(async (response) => {
          if (!Array.isArray(response?.budgets)) {
            throw new Error("The budgets service returned an invalid response.")
          }

          const loadedBudgets = await Promise.all(
            response.budgets.map(async (budget) => {
              if (!budget?.id) {
                throw new Error(
                  "The budgets service returned an invalid budget.",
                )
              }

              return {
                ...budget,

                spending: await loadBudgetSpending(budget.id, token),
              }
            }),
          )

          if (isCurrentSession(activeSessionRef, sessionKey, token)) {
            const preserveCurrentSpending =
              spendingRevision !== spendingRevisionRef.current
            const currentBudgets =
              stateRef.current.sessionKey === sessionKey
                ? stateRef.current.budgets
                : []
            const budgets = preserveCurrentSpending
              ? loadedBudgets.map((budget) => {
                  const currentBudget = currentBudgets.find(
                    (item) => item.id === budget.id,
                  )

                  return currentBudget?.spending
                    ? { ...budget, spending: currentBudget.spending }
                    : { ...budget, spending: undefined }
                })
              : loadedBudgets
            const actions = actionsRef.current.filter(
              (action) =>
                action.sessionKey === sessionKey &&
                action.sequence > requestSequence,
            )

            const nextBudgets = actions.reduce(
              applyBudgetAction,

              sortBudgets(budgets),
            )

            setState((current) => {
              if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
                return current
              }

              return {
                sessionKey,

                budgets: budgetsEqual(current.budgets, nextBudgets)
                  ? current.budgets
                  : nextBudgets,

                loading:
                  current.sessionKey === sessionKey ? current.loading : false,

                error: "",
              }
            })
          }

          actionsRef.current = actionsRef.current.filter(
            (action) =>
              action.sessionKey !== sessionKey ||
              action.sequence > requestSequence,
          )

          return true
        })

        .catch((requestError) => {
          if (isCurrentSession(activeSessionRef, sessionKey, token)) {
            setState((current) => ({
              ...current,

              sessionKey,

              error: requestError.message || "Could not load budgets.",
            }))
          }

          return false
        })

        .finally(() => {
          if (isCurrentSession(activeSessionRef, sessionKey, token)) {
            setState((current) =>
              current.sessionKey === sessionKey
                ? { ...current, loading: false }
                : current,
            )
          }

          if (requestRef.current?.promise === request) requestRef.current = null
        })

      requestRef.current = { sessionKey, promise: request }

      return request
    },
    [sessionKey, token],
  )

  const refreshBudgetSpending = useCallback(() => {
    if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
      return Promise.resolve(false)
    }

    const pendingRefresh = spendingRefreshRef.current
    if (pendingRefresh?.sessionKey === sessionKey) {
      pendingRefresh.dirty = true
      return pendingRefresh.promise
    }

    const refresh = { sessionKey, dirty: false, promise: null }

    const runRefresh = async () => {
      do {
        refresh.dirty = false
        const current = stateRef.current
        const budgets = current.sessionKey === sessionKey ? current.budgets : []

        if (budgets.length === 0) return true

        const revision = spendingRevisionRef.current
        const spendingEntries = await Promise.all(
          budgets.map(async (budget) => [
            budget.id,
            await loadBudgetSpending(budget.id, token),
          ]),
        )

        if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
          return false
        }
        if (refresh.dirty || revision !== spendingRevisionRef.current) continue

        const spendingById = new Map(spendingEntries)
        setState((latest) => {
          if (
            !isCurrentSession(activeSessionRef, sessionKey, token) ||
            latest.sessionKey !== sessionKey
          ) {
            return latest
          }

          const nextBudgets = latest.budgets.map((budget) => {
            const spending = spendingById.get(budget.id)
            return spending ? { ...budget, spending } : budget
          })

          const budgetsChanged = nextBudgets.some(
            (budget, index) => budget !== latest.budgets[index],
          )

          return budgetsChanged || latest.error
            ? { ...latest, budgets: nextBudgets, error: "" }
            : latest
        })
      } while (refresh.dirty)

      return true
    }

    refresh.promise = runRefresh()
      .catch((requestError) => {
        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          setState((current) =>
            current.sessionKey === sessionKey
              ? {
                  ...current,
                  error:
                    requestError.message ||
                    "Could not refresh budget spending.",
                }
              : current,
          )
        }

        return false
      })
      .finally(() => {
        if (spendingRefreshRef.current === refresh) {
          spendingRefreshRef.current = null
        }
      })

    spendingRefreshRef.current = refresh
    return refresh.promise
  }, [sessionKey, token])

  const requestBudgetSpendingRefresh = useCallback(() => {
    if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
      return Promise.resolve(false)
    }
    spendingRevisionRef.current += 1
    spendingRefreshRequestedRef.current = true

    const current = stateRef.current
    if (current.sessionKey !== sessionKey || current.loading) {
      return Promise.resolve(false)
    }

    if (current.budgets.length === 0) {
      spendingRefreshRequestedRef.current = false
      return Promise.resolve(true)
    }

    spendingRefreshRequestedRef.current = false
    return refreshBudgetSpending()
  }, [refreshBudgetSpending, sessionKey, token])

  useEffect(() => {
    if (transactionsLoading || !sessionKey) return

    const previous = transactionSnapshotRef.current
    if (!previous || previous.sessionKey !== sessionKey) {
      transactionSnapshotRef.current = { sessionKey, transactions }
      return
    }

    const budgets = state.sessionKey === sessionKey ? state.budgets : []
    const changed =
      getBudgetContributionSignature(previous.transactions, budgets) !==
      getBudgetContributionSignature(transactions, budgets)

    transactionSnapshotRef.current = { sessionKey, transactions }

    if (changed && budgets.length > 0) requestBudgetSpendingRefresh()
  }, [
    transactions,
    transactionsLoading,
    sessionKey,
    state.sessionKey,
    state.budgets,
    requestBudgetSpendingRefresh,
  ])

  useEffect(() => {
    if (
      !spendingRefreshRequestedRef.current ||
      state.loading ||
      state.sessionKey !== sessionKey
    ) {
      return
    }

    spendingRefreshRequestedRef.current = false
    if (state.budgets.length > 0) refreshBudgetSpending()
  }, [
    refreshBudgetSpending,
    sessionKey,
    state.budgets,
    state.loading,
    state.sessionKey,
  ])

  const recordAction = useCallback(
    (action) => {
      const sequencedAction = {
        ...action,

        sessionKey,

        sequence: ++sequenceRef.current,
      }

      if (requestRef.current?.sessionKey === sessionKey) {
        actionsRef.current.push(sequencedAction)
      }

      setState((current) => {
        if (
          !isCurrentSession(activeSessionRef, sessionKey, token) ||
          current.sessionKey !== sessionKey
        ) {
          return current
        }

        const budgets = applyBudgetAction(current.budgets, sequencedAction)
        return budgets === current.budgets && !current.error
          ? current
          : { ...current, budgets, error: "" }
      })
    },

    [sessionKey],
  )

  const upsertBudget = useCallback(
    (budget) => {
      if (
        !isCurrentSession(activeSessionRef, sessionKey, token) ||
        typeof budget?.id !== "string"
      ) {
        return
      }

      recordAction({ type: "upsert", budget })

      if (!budget.spending && token) {
        loadBudgetSpending(budget.id, token)

          .then((spending) => {
            if (isCurrentSession(activeSessionRef, sessionKey, token)) {
              recordAction({
                type: "upsert",

                budget: { ...budget, spending },
              })
            }
          })

          .catch(() => {
            if (isCurrentSession(activeSessionRef, sessionKey, token)) {
              refreshBudgets()
            }
          })
      }
    },

    [recordAction, refreshBudgets, sessionKey, token],
  )

  const removeBudget = useCallback(
    (id) => {
      if (id) recordAction({ type: "remove", id })
    },

    [recordAction],
  )

  const requireSession = useCallback(() => {
    if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
      throw new Error("Sign in to manage budgets.")
    }
  }, [sessionKey, token])

  const createBudget = useCallback(
    async (data) => {
      requireSession()

      const response = await apiRequest("budgets", {
        method: "POST",

        token,

        body: data,
      })

      if (!response?.budget?.id) {
        throw new Error("The budgets service returned an invalid response.")
      }

      upsertBudget(response.budget)

      return response.budget
    },

    [requireSession, token, upsertBudget],
  )

  const updateBudget = useCallback(
    async (id, data) => {
      requireSession()

      const response = await apiRequest(
        `budgets/${encodeURIComponent(id)}`,

        { method: "PATCH", token, body: data },
      )

      if (!response?.budget?.id) {
        throw new Error("The budgets service returned an invalid response.")
      }

      upsertBudget(response.budget)

      return response.budget
    },

    [requireSession, token, upsertBudget],
  )

  const deleteBudget = useCallback(
    async (id) => {
      requireSession()

      await apiRequest(`budgets/${encodeURIComponent(id)}`, {
        method: "DELETE",

        token,
      })

      removeBudget(id)
    },

    [removeBudget, requireSession, token],
  )

  useEffect(() => {
    if (previousSessionRef.current !== sessionKey) {
      actionsRef.current = actionsRef.current.filter(
        (action) => action.sessionKey === sessionKey,
      )
      previousSessionRef.current = sessionKey
      transactionSnapshotRef.current = null
      spendingRefreshRequestedRef.current = false
    }

    if (!sessionKey || !token) {
      actionsRef.current = []

      setState((current) =>
        current.sessionKey === null &&
        current.budgets.length === 0 &&
        !current.loading &&
        !current.error
          ? current
          : { sessionKey: null, budgets: [], loading: false, error: "" },
      )

      return undefined
    }

    activeSessionRef.current = sessionKey

    setState((current) =>
      current.sessionKey === sessionKey
        ? current
        : { sessionKey, budgets: [], loading: true, error: "" },
    )

    refreshBudgets()

    return () => {
      if (activeSessionRef.current === sessionKey) {
        activeSessionRef.current = null
      }
    }
  }, [refreshBudgets, sessionKey, token])

  useEffect(() => {
    if (!sessionKey || !token) return undefined

    let connectedBefore = false

    const socket = io(getSocketBaseUrl(), {
      auth: { token },

      autoConnect: false,

      reconnection: true,
    })

    const handleConnect = () => {
      if (!isCurrentSession(activeSessionRef, sessionKey, token)) return
      if (connectedBefore) refreshBudgets({ afterPending: true })
      connectedBefore = true
    }

    const handleCreatedOrUpdated = (event) => {
      const budget = event?.budget

      if (
        !isCurrentSession(activeSessionRef, sessionKey, token) ||
        typeof budget?.id !== "string"
      ) {
        return
      }

      upsertBudget(budget)
    }

    const handleDeleted = (event) => {
      if (
        isCurrentSession(activeSessionRef, sessionKey, token) &&
        typeof event?.budgetId === "string"
      ) {
        removeBudget(event.budgetId)
      }
    }

    socket.on("connect", handleConnect)

    socket.on("budget:created", handleCreatedOrUpdated)

    socket.on("budget:updated", handleCreatedOrUpdated)

    socket.on("budget:deleted", handleDeleted)

    socket.connect()

    return () => {
      socket.off("connect", handleConnect)

      socket.off("budget:created", handleCreatedOrUpdated)

      socket.off("budget:updated", handleCreatedOrUpdated)

      socket.off("budget:deleted", handleDeleted)

      socket.disconnect()
    }
  }, [refreshBudgets, removeBudget, sessionKey, token, upsertBudget])

  const value = useMemo(
    () => ({
      budgets: state.sessionKey === sessionKey ? state.budgets : [],

      loading:
        state.sessionKey === sessionKey ? state.loading : Boolean(sessionKey),

      error: state.sessionKey === sessionKey ? state.error : "",

      refreshBudgets,

      createBudget,

      updateBudget,

      deleteBudget,

      upsertBudget,

      removeBudget,
    }),

    [
      state,

      sessionKey,

      refreshBudgets,

      createBudget,

      updateBudget,

      deleteBudget,

      upsertBudget,

      removeBudget,
    ],
  )

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  )
}

export function useBudgets() {
  const context = useContext(BudgetContext)

  if (!context) {
    throw new Error("useBudgets must be used within a BudgetProvider")
  }

  return context
}

export default BudgetProvider
