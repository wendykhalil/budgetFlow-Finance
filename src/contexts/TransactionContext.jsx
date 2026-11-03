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

import { apiRequest, getSocketBaseUrl } from "@/lib/api"

const TransactionContext = createContext(null)

const TOKEN_KEY = "budgetflow_token"

function isActiveSession(activeSessionRef, sessionKey, token) {
  return Boolean(
    sessionKey &&
      token &&
      activeSessionRef.current === sessionKey &&
      localStorage.getItem(TOKEN_KEY) === token,
  )
}

function createEmptyState(sessionKey = null) {
  return {
    sessionKey,

    transactions: [],

    loading: false,

    error: "",

    socketError: "",
  }
}

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const dateOrder = String(b.date || "").localeCompare(String(a.date || ""))

    return (
      dateOrder ||
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )
  })
}

export function applyTransactionAction(transactions, action) {
  if (action.type === "delete") {
    const updated = transactions.filter(
      (transaction) => transaction.id !== action.id,
    )

    return updated.length === transactions.length ? transactions : updated
  }

  const index = transactions.findIndex(
    (transaction) => transaction.id === action.transaction.id,
  )

  if (
    index !== -1 &&
    areTransactionsEqual(transactions[index], action.transaction)
  ) {
    return transactions
  }

  const updated =
    index === -1
      ? [...transactions, action.transaction]
      : transactions.map((transaction, itemIndex) =>
          itemIndex === index ? action.transaction : transaction,
        )

  return sortTransactions(updated)
}

function areTransactionsEqual(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])

  for (const key of keys) {
    if (left[key] !== right[key]) return false
  }

  return true
}

function areTransactionListsEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((transaction, index) =>
      areTransactionsEqual(transaction, right[index]),
    )
  )
}

export function TransactionProvider({ children }) {
  const { user } = useAuth()

  const userId = user?.id || null

  const token = localStorage.getItem(TOKEN_KEY)

  const sessionKey = userId && token ? `${userId}:${token}` : null

  const [state, setState] = useState(() => createEmptyState())

  const activeSessionRef = useRef(sessionKey)

  const requestRef = useRef(null)

  const actionsRef = useRef([])

  const sequenceRef = useRef(0)

  const mountedRef = useRef(false)

  const hasSucceededSessionRef = useRef(null)

  const previousSessionRef = useRef(sessionKey)

  activeSessionRef.current = sessionKey

  const refreshTransactions = useCallback(
    (options = {}) => {
      if (!isActiveSession(activeSessionRef, sessionKey, token)) {
        return Promise.resolve(false)
      }

      const pendingRequest = requestRef.current

      if (pendingRequest?.sessionKey === sessionKey) {
        if (options.afterPending) {
          return pendingRequest.promise.then(() =>
            isActiveSession(activeSessionRef, sessionKey, token)
              ? refreshTransactions()
              : false,
          )
        }

        return pendingRequest.promise
      }

      const requestSequence = sequenceRef.current
      const shouldShowLoading = hasSucceededSessionRef.current !== sessionKey

      setState((current) => ({
        ...createEmptyState(sessionKey),

        transactions:
          current.sessionKey === sessionKey ? current.transactions : [],

        loading: current.sessionKey !== sessionKey || shouldShowLoading,
      }))

      const request = apiRequest("transactions", { token })

        .then((response) => {
          if (!Array.isArray(response?.transactions)) {
            throw new Error(
              "The transactions service returned an invalid response.",
            )
          }

          if (
            mountedRef.current &&
            isActiveSession(activeSessionRef, sessionKey, token)
          ) {
            const actions = actionsRef.current.filter(
              (action) =>
                action.sessionKey === sessionKey &&
                action.sequence > requestSequence,
            )

            const nextTransactions = actions.reduce(
              (current, action) => applyTransactionAction(current, action),

              sortTransactions(response.transactions),
            )

            setState((current) => {
              if (!isActiveSession(activeSessionRef, sessionKey, token)) {
                return current
              }

              const currentTransactions =
                current.sessionKey === sessionKey ? current.transactions : []

              return {
                ...createEmptyState(sessionKey),

                transactions: areTransactionListsEqual(
                  currentTransactions,

                  nextTransactions,
                )
                  ? currentTransactions
                  : nextTransactions,
              }
            })

            hasSucceededSessionRef.current = sessionKey
          }

          actionsRef.current = actionsRef.current.filter(
            (action) =>
              action.sessionKey !== sessionKey ||
              action.sequence > requestSequence,
          )

          return true
        })

        .catch((requestError) => {
          if (
            mountedRef.current &&
            isActiveSession(activeSessionRef, sessionKey, token)
          ) {
            setState((current) => ({
              ...createEmptyState(sessionKey),

              transactions:
                current.sessionKey === sessionKey ? current.transactions : [],

              error: requestError.message || "Could not load transactions.",
            }))
          }

          return false
        })

        .finally(() => {
          if (
            mountedRef.current &&
            isActiveSession(activeSessionRef, sessionKey, token)
          ) {
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

  const recordAction = useCallback(
    (action) => {
      if (!isActiveSession(activeSessionRef, sessionKey, token)) return

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
          !isActiveSession(activeSessionRef, sessionKey, token) ||
          current.sessionKey !== sessionKey
        ) {
          return current
        }

        const transactions = applyTransactionAction(
          current.transactions,

          sequencedAction,
        )

        return transactions === current.transactions
          ? current
          : { ...current, transactions }
      })
    },
    [sessionKey, token],
  )

  const upsertTransaction = useCallback(
    (transaction) => {
      if (transaction?.id) recordAction({ type: "upsert", transaction })
    },
    [recordAction],
  )

  const removeTransaction = useCallback(
    (id) => {
      if (id) recordAction({ type: "delete", id })
    },
    [recordAction],
  )

  useEffect(() => {
    mountedRef.current = true
    if (previousSessionRef.current !== sessionKey) {
      actionsRef.current = actionsRef.current.filter(
        (action) => action.sessionKey === sessionKey,
      )
      previousSessionRef.current = sessionKey
    }

    if (!sessionKey || !token) {
      actionsRef.current = []

      requestRef.current = null

      hasSucceededSessionRef.current = null

      setState(createEmptyState())

      return () => {
        mountedRef.current = false
      }
    }

    setState((current) =>
      current.sessionKey === sessionKey
        ? current
        : { ...createEmptyState(sessionKey), loading: true },
    )

    void refreshTransactions()

    return () => {
      mountedRef.current = false

      if (activeSessionRef.current === sessionKey) {
        activeSessionRef.current = null
      }
    }
  }, [refreshTransactions, sessionKey, token])

  useEffect(() => {
    if (!isActiveSession(activeSessionRef, sessionKey, token)) {
      return undefined
    }

    let connectedBefore = false

    const socket = io(getSocketBaseUrl(), {
      auth: { token },

      autoConnect: false,

      reconnection: true,
    })

    const handleUpsert = (event) => {
      if (
        isActiveSession(activeSessionRef, sessionKey, token) &&
        event?.transaction?.id
      ) {
        upsertTransaction(event.transaction)
      }
    }

    const handleDelete = (event) => {
      if (isActiveSession(activeSessionRef, sessionKey, token) && event?.id) {
        removeTransaction(event.id)
      }
    }

    const handleConnect = () => {
      if (!isActiveSession(activeSessionRef, sessionKey, token)) return

      setState((current) =>
        current.sessionKey === sessionKey
          ? { ...current, socketError: "" }
          : current,
      )

      if (connectedBefore) refreshTransactions({ afterPending: true })

      connectedBefore = true
    }

    const handleConnectError = (connectionError) => {
      if (!isActiveSession(activeSessionRef, sessionKey, token)) return

      setState((current) =>
        current.sessionKey === sessionKey
          ? {
              ...current,

              socketError:
                connectionError?.data?.code === "AUTH_REQUIRED"
                  ? "Real-time synchronization is unavailable. Please sign in again."
                  : "Real-time synchronization is temporarily unavailable.",
            }
          : current,
      )

      if (connectionError?.data?.code === "AUTH_REQUIRED") socket.disconnect()
    }

    socket.on("connect", handleConnect)

    socket.on("connect_error", handleConnectError)

    socket.on("transaction:created", handleUpsert)

    socket.on("transaction:updated", handleUpsert)

    socket.on("transaction:deleted", handleDelete)

    socket.connect()

    return () => {
      socket.off("connect", handleConnect)

      socket.off("connect_error", handleConnectError)

      socket.off("transaction:created", handleUpsert)

      socket.off("transaction:updated", handleUpsert)

      socket.off("transaction:deleted", handleDelete)

      socket.disconnect()
    }
  }, [
    sessionKey,
    token,
    refreshTransactions,
    upsertTransaction,
    removeTransaction,
  ])

  const currentState =
    state.sessionKey === sessionKey ? state : createEmptyState(sessionKey)

  const contextValue = useMemo(
    () => ({
      transactions: currentState.transactions,

      loading: sessionKey
        ? currentState.loading || state.sessionKey !== sessionKey
        : false,

      error: currentState.error,

      socketError: currentState.socketError,

      refreshTransactions,

      upsertTransaction,

      removeTransaction,
    }),
    [
      currentState,

      sessionKey,

      state.sessionKey,

      refreshTransactions,

      upsertTransaction,

      removeTransaction,
    ],
  )

  return (
    <TransactionContext.Provider value={contextValue}>
      {currentState.socketError && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {currentState.socketError}
        </p>
      )}
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const context = useContext(TransactionContext)

  if (!context) {
    throw new Error("useTransactions must be used within a TransactionProvider")
  }

  return context
}

export default TransactionProvider
