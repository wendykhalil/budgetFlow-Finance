import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest, getSocketBaseUrl } from '@/lib/api'

const TransactionContext = createContext(null)

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const dateOrder = String(b.date || '').localeCompare(String(a.date || ''))
    return dateOrder || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
}

export function applyTransactionAction(transactions, action) {
  if (action.type === 'delete') {
    const updated = transactions.filter((transaction) => transaction.id !== action.id)
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
  const updated = index === -1
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
  return left.length === right.length && left.every((transaction, index) =>
    areTransactionsEqual(transaction, right[index]),
  )
}

export function TransactionProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const token = localStorage.getItem('budgetflow_token')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [socketError, setSocketError] = useState('')
  const requestRef = useRef(null)
  const actionsRef = useRef([])
  const sequenceRef = useRef(0)
  const mountedRef = useRef(false)
  const hasSucceededRef = useRef(false)

  const refreshTransactions = useCallback((options = {}) => {
    if (requestRef.current) {
      if (options.afterPending) {
        return requestRef.current.then(() =>
          mountedRef.current ? refreshTransactions() : false,
        )
      }
      return requestRef.current
    }

    const requestSequence = sequenceRef.current
    setError('')
    if (!hasSucceededRef.current) setLoading(true)
    const request = apiRequest('transactions', {
      token: localStorage.getItem('budgetflow_token'),
    })
      .then((response) => {
        if (!Array.isArray(response?.transactions)) {
          throw new Error('The transactions service returned an invalid response.')
        }
        if (mountedRef.current) {
          const actions = actionsRef.current.filter(
            (action) => action.sequence > requestSequence,
          )
          const nextTransactions = actions.reduce(
            (current, action) => applyTransactionAction(current, action),
            sortTransactions(response.transactions),
          )
          setTransactions((current) =>
            areTransactionListsEqual(current, nextTransactions)
              ? current
              : nextTransactions,
          )
          setError('')
          hasSucceededRef.current = true
        }
        actionsRef.current = actionsRef.current.filter(
          (action) => action.sequence > requestSequence,
        )
        return true
      })
      .catch((requestError) => {
        if (mountedRef.current) {
          setError(requestError.message || 'Could not load transactions.')
        }
        return false
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
        requestRef.current = null
      })

    requestRef.current = request
    return request
  }, [])

  const recordAction = useCallback((action) => {
    const sequencedAction = { ...action, sequence: ++sequenceRef.current }
    if (requestRef.current) actionsRef.current.push(sequencedAction)
    setTransactions((current) => applyTransactionAction(current, sequencedAction))
  }, [])

  const upsertTransaction = useCallback((transaction) => {
    if (transaction?.id) recordAction({ type: 'upsert', transaction })
  }, [recordAction])

  const removeTransaction = useCallback((id) => {
    if (id) recordAction({ type: 'delete', id })
  }, [recordAction])

  useEffect(() => {
    mountedRef.current = true
    refreshTransactions()
    return () => {
      mountedRef.current = false
    }
  }, [refreshTransactions, userId])

  useEffect(() => {
    if (!userId || !token) return undefined

    let connectedBefore = false
    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      autoConnect: false,
      reconnection: true,
    })

    const handleUpsert = (event) => {
      if (event?.transaction?.id) upsertTransaction(event.transaction)
    }
    const handleDelete = (event) => {
      if (event?.id) removeTransaction(event.id)
    }
    const handleConnect = () => {
      setSocketError('')
      if (connectedBefore) refreshTransactions({ afterPending: true })
      connectedBefore = true
    }
    const handleConnectError = (connectionError) => {
      setSocketError(
        connectionError?.data?.code === 'AUTH_REQUIRED'
          ? 'Real-time synchronization is unavailable. Please sign in again.'
          : 'Real-time synchronization is temporarily unavailable.',
      )
      if (connectionError?.data?.code === 'AUTH_REQUIRED') socket.disconnect()
    }

    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('transaction:created', handleUpsert)
    socket.on('transaction:updated', handleUpsert)
    socket.on('transaction:deleted', handleDelete)
    socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('connect_error', handleConnectError)
      socket.off('transaction:created', handleUpsert)
      socket.off('transaction:updated', handleUpsert)
      socket.off('transaction:deleted', handleDelete)
      socket.disconnect()
    }
  }, [userId, token, refreshTransactions, upsertTransaction, removeTransaction])

  const contextValue = useMemo(() => ({
    transactions,
    loading,
    error,
    socketError,
    refreshTransactions,
    upsertTransaction,
    removeTransaction,
  }), [
    transactions,
    loading,
    error,
    socketError,
    refreshTransactions,
    upsertTransaction,
    removeTransaction,
  ])

  return (
    <TransactionContext.Provider value={contextValue}>
      {socketError && (
        <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {socketError}
        </p>
      )}
      {children}
    </TransactionContext.Provider>
  )
}

export function useTransactions() {
  const context = useContext(TransactionContext)
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider')
  }
  return context
}

export default TransactionProvider
