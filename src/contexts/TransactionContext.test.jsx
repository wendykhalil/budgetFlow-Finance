import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: window.__budgetflowTestUser }),
}))
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  getSocketBaseUrl: () => 'http://localhost:5000',
}))
vi.mock('socket.io-client', () => ({ io: vi.fn() }))

import { apiRequest } from '@/lib/api'
import { io } from 'socket.io-client'
import ClientDashboard from '@/pages/client/Dashboard'
import ClientTransactions from '@/pages/client/Transactions'
import {
  applyTransactionAction,
  TransactionProvider,
  useTransactions,
} from '@/contexts/TransactionContext'
import { getDashboardMetrics } from '@/utils/dashboardMetrics'

let socket

function makeSocket() {
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
    connect: vi.fn(() => handlers.get('connect')?.()),
    disconnect: vi.fn(),
    emitFromServer(event, payload) {
      handlers.get(event)?.(payload)
    },
  }
}

function TestConsumer() {
  const { transactions, loading, error } = useTransactions()
  return (
    <div>
      <span>{loading ? 'Loading' : 'Loaded'}</span>
      {error && <span role="alert">{error}</span>}
      {transactions.map((transaction) => <span key={transaction.id}>{transaction.description}</span>)}
    </div>
  )
}

function renderTransactionsPage() {
  return render(
    <MemoryRouter>
      <TransactionProvider>
        <ClientTransactions />
      </TransactionProvider>
    </MemoryRouter>,
  )
}

function LocationState() {
  const location = useLocation()
  return <span data-testid="location-state">{location.state?.successMessage || 'consumed'}</span>
}

function transaction(overrides = {}) {
  return {
    id: 'transaction-1',
    date: new Date().toISOString().slice(0, 10),
    description: 'Initial transaction',
    category: 'Food',
    type: 'expense',
    amount: 25,
    status: 'completed',
    ...overrides,
  }
}

beforeEach(() => {
  window.__budgetflowTestUser = { id: 'user-1', firstName: 'Taylor', currency: 'USD' }
  localStorage.setItem('budgetflow_token', 'test-token')
  socket = makeSocket()
  io.mockReturnValue(socket)
  apiRequest.mockReset()
  apiRequest.mockResolvedValue({ transactions: [] })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('transaction synchronization', () => {
  it('keeps state unchanged for duplicate events and deletes of missing records', () => {
    const current = [transaction()]
    expect(applyTransactionAction(current, {
      type: 'upsert',
      transaction: { ...current[0] },
    })).toBe(current)
    expect(applyTransactionAction(current, {
      type: 'delete',
      id: 'missing',
    })).toBe(current)
  })

  it('finishes list loading after a successful REST response', async () => {
    apiRequest.mockResolvedValueOnce({ transactions: [transaction()] })
    renderTransactionsPage()

    expect(screen.getByText('Loading transactions...')).toBeTruthy()
    expect(await screen.findByText('Initial transaction')).toBeTruthy()
    expect(screen.queryByText('Loading transactions...')).toBeNull()
  })

  it('finishes list loading and displays an API error after a failed response', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Service unavailable'))
    renderTransactionsPage()

    expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable')
    expect(screen.queryByText('Loading transactions...')).toBeNull()
  })

  it('applies create, update, and delete socket events without duplicate rows', async () => {
    renderTransactionsPage()
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))

    const item = transaction({ id: 'remote-1', description: 'Remote purchase' })
    act(() => {
      socket.emitFromServer('transaction:created', { transaction: item })
      socket.emitFromServer('transaction:created', { transaction: item })
    })
    expect(screen.getAllByText('Remote purchase')).toHaveLength(1)

    act(() => {
      socket.emitFromServer('transaction:updated', {
        transaction: { ...item, description: 'Updated purchase', amount: 40 },
      })
    })
    expect(screen.getByText('Updated purchase')).toBeTruthy()
    expect(screen.queryByText('Remote purchase')).toBeNull()

    act(() => socket.emitFromServer('transaction:deleted', { id: 'remote-1' }))
    expect(screen.queryByText('Updated purchase')).toBeNull()
  })

  it('refreshes from REST after reconnect and disconnects when the authenticated user logs out', async () => {
    const view = render(
      <TransactionProvider>
        <TestConsumer />
      </TransactionProvider>,
    )
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))

    act(() => socket.emitFromServer('connect'))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))

    window.__budgetflowTestUser = null
    view.rerender(
      <TransactionProvider>
        <TestConsumer />
      </TransactionProvider>,
    )
    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('runs a fresh REST request if a reconnect happens during an older request', async () => {
    let finishInitialRequest
    apiRequest
      .mockImplementationOnce(() => new Promise((resolve) => {
        finishInitialRequest = resolve
      }))
      .mockResolvedValueOnce({
        transactions: [transaction({ id: 'reconnected', description: 'Synced after reconnect' })],
      })

    render(
      <TransactionProvider>
        <TestConsumer />
      </TransactionProvider>,
    )
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))

    act(() => socket.emitFromServer('connect'))
    expect(apiRequest).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishInitialRequest({ transactions: [] })
      await Promise.resolve()
    })
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Synced after reconnect')).toBeTruthy()
  })

  it('updates Dashboard totals from socket events using the configured currency', async () => {
    render(
      <MemoryRouter>
        <TransactionProvider>
          <ClientDashboard />
        </TransactionProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
    const income = transaction({
      id: 'income-1',
      date: new Date().toISOString().slice(0, 10),
      description: 'Salary',
      category: 'Salary',
      type: 'income',
      amount: 1200,
    })
    const expense = transaction({
      id: 'expense-1',
      date: new Date().toISOString().slice(0, 10),
      description: 'Rent',
      category: 'Housing',
      amount: 450,
    })

    act(() => {
      socket.emitFromServer('transaction:created', { transaction: income })
      socket.emitFromServer('transaction:created', { transaction: expense })
    })

    const totalIncomeLabel = screen.getByText('Total income')
    expect(totalIncomeLabel.parentElement.textContent).toContain(
      new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(1200),
    )
    const balanceLabel = screen.getByText('Total balance')
    expect(balanceLabel.parentElement.textContent).toContain(
      new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(750),
    )
  })

  it('shows empty-account states instead of transaction mock data', async () => {
    render(
      <MemoryRouter>
        <TransactionProvider>
          <ClientDashboard />
        </TransactionProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('No transactions yet. Add one to get started.')).toBeTruthy()
    expect(screen.getByText('No completed expenses this month.')).toBeTruthy()
  })

  it('consumes the success navigation state once without repeating the toast effect', async () => {
    render(
      <MemoryRouter
        initialEntries={[{
          pathname: '/client/transactions',
          state: { successMessage: 'Transaction created.' },
        }]}
      >
        <TransactionProvider>
          <ClientTransactions />
          <LocationState />
        </TransactionProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Transaction created.')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('location-state').textContent).toBe('consumed'))
    expect(screen.getAllByText('Transaction created.')).toHaveLength(1)
  })
})

describe('Dashboard transaction calculations', () => {
  it('uses completed transactions and their actual year/month dates', () => {
    const metrics = getDashboardMetrics([
      transaction({ type: 'income', amount: 2400, date: '2026-10-03' }),
      transaction({ id: 'expense', amount: 350, date: '2026-10-12', category: 'Housing' }),
      transaction({ id: 'pending', amount: 5000, status: 'pending', date: '2026-10-14' }),
      transaction({ id: 'prior-year', type: 'income', amount: 900, date: '2025-10-14' }),
    ], new Date('2026-10-30T12:00:00Z'))

    expect(metrics.totalIncome).toBe(3300)
    expect(metrics.totalExpenses).toBe(350)
    expect(metrics.totalBalance).toBe(2950)
    expect(metrics.savings).toBe(2950)
    expect(metrics.monthlyTotals[9]).toEqual({ month: 'Oct', income: 2400, expense: 350 })
    expect(metrics.expensesByCategory).toEqual([
      { name: 'Housing', value: 350, color: '#155C4F' },
    ])
  })

  it('returns zero totals and empty categories for an account with no transactions', () => {
    const metrics = getDashboardMetrics([], new Date('2026-10-30T12:00:00Z'))
    expect(metrics.totalIncome).toBe(0)
    expect(metrics.totalExpenses).toBe(0)
    expect(metrics.totalBalance).toBe(0)
    expect(metrics.expensesByCategory).toEqual([])
    expect(metrics.recentTransactions).toEqual([])
    expect(metrics.monthlyTotals).toHaveLength(12)
  })
})
