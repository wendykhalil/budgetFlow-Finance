import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useAuth } from "@/contexts/AuthContext"

import { apiRequest } from "@/lib/api"

const NotificationContext = createContext(null)

const PAGE_SIZE = 20

const TOKEN_KEY = "budgetflow_token"

function isCurrentSession(activeSessionRef, sessionKey, token) {
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

    notifications: [],

    unreadCount: 0,

    pagination: {
      page: 1,

      limit: PAGE_SIZE,

      total: 0,

      totalPages: 0,
    },

    loading: false,

    notificationsError: "",

    unreadCountError: "",

    actionError: "",

    readingIds: [],

    deletingIds: [],

    markingAllAsRead: false,
  }
}

function isValidNotificationListResponse(response) {
  return (
    Array.isArray(response?.notifications) &&
    response.notifications.every(
      (notification) =>
        typeof notification?.id === "string" &&
        typeof notification.title === "string" &&
        typeof notification.message === "string" &&
        typeof notification.isRead === "boolean" &&
        typeof notification.createdAt === "string",
    ) &&
    Number.isSafeInteger(response?.pagination?.page) &&
    response.pagination.page > 0 &&
    Number.isSafeInteger(response.pagination.limit) &&
    response.pagination.limit > 0 &&
    Number.isSafeInteger(response.pagination.total) &&
    response.pagination.total >= 0 &&
    Number.isSafeInteger(response.pagination.totalPages) &&
    response.pagination.totalPages >= 0
  )
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback
}

export function NotificationProvider({ children }) {
  const { user, logout, socket } = useAuth()

  const userId = user?.role === "client" ? user.id : null

  const token = localStorage.getItem(TOKEN_KEY)

  const sessionKey = userId && token ? `${userId}:${token}` : null

  const [state, setRawState] = useState(() => createEmptyState())

  const stateRef = useRef(state)

  const setState = useCallback((update) => {
    const previous = stateRef.current
    const next = typeof update === "function" ? update(previous) : update

    if (next === previous) return

    stateRef.current = next
    setRawState(next)
  }, [])

  const activeSessionRef = useRef(sessionKey)

  const mountedRef = useRef(false)

  const logoutRef = useRef(logout)

  const listRequestIdRef = useRef(0)

  const countRequestIdRef = useRef(0)

  const currentPageRef = useRef(1)

  const activeItemOperationsRef = useRef(new Set())

  const activeBulkOperationsRef = useRef(new Set())

  const seenSocketNotificationIdsRef = useRef(new Set())

  activeSessionRef.current = sessionKey

  stateRef.current = state

  logoutRef.current = logout

  const fetchNotifications = useCallback(
    async (page = 1) => {
      if (!isCurrentSession(activeSessionRef, sessionKey, token)) return false

      if (!Number.isSafeInteger(page) || page < 1) {
        setState((current) => ({
          ...(current.sessionKey === sessionKey
            ? current
            : createEmptyState(sessionKey)),

          loading: false,

          notificationsError: "Page must be a positive whole number.",
        }))

        return false
      }

      const requestId = ++listRequestIdRef.current

      setState((current) => ({
        ...(current.sessionKey === sessionKey
          ? current
          : createEmptyState(sessionKey)),

        loading: true,

        notificationsError: "",
      }))

      try {
        const response = await apiRequest(
          `notifications?page=${page}&limit=${PAGE_SIZE}`,

          { token },
        )

        if (!isValidNotificationListResponse(response)) {
          throw new Error(
            "The notifications service returned an invalid response.",
          )
        }

        if (
          mountedRef.current &&
          isCurrentSession(activeSessionRef, sessionKey, token) &&
          listRequestIdRef.current === requestId
        ) {
          currentPageRef.current = response.pagination.page

          setState((current) => ({
            ...(current.sessionKey === sessionKey
              ? current
              : createEmptyState(sessionKey)),

            notifications: response.notifications,

            pagination: response.pagination,

            loading: false,

            notificationsError: "",
          }))
        }

        return true
      } catch (error) {
        if (
          mountedRef.current &&
          isCurrentSession(activeSessionRef, sessionKey, token) &&
          listRequestIdRef.current === requestId
        ) {
          const message = getErrorMessage(
            error,

            "Could not load notifications.",
          )

          setState((current) => ({
            ...(current.sessionKey === sessionKey
              ? current
              : createEmptyState(sessionKey)),

            loading: false,

            notificationsError: message,
          }))

          if (
            error?.status === 401 &&
            localStorage.getItem(TOKEN_KEY) === token
          ) {
            logoutRef.current()
          }
        }

        return false
      } finally {
        if (
          mountedRef.current &&
          isCurrentSession(activeSessionRef, sessionKey, token) &&
          listRequestIdRef.current === requestId
        ) {
          setState((current) =>
            current.sessionKey === sessionKey
              ? { ...current, loading: false }
              : current,
          )
        }
      }
    },

    [sessionKey, token],
  )

  const refreshUnreadCount = useCallback(async () => {
    if (!isCurrentSession(activeSessionRef, sessionKey, token)) return false

    const requestId = ++countRequestIdRef.current

    try {
      const response = await apiRequest("notifications/unread-count", {
        token,
      })

      if (
        !Number.isSafeInteger(response?.unreadCount) ||
        response.unreadCount < 0
      ) {
        throw new Error(
          "The unread notifications service returned an invalid response.",
        )
      }

      if (
        mountedRef.current &&
        isCurrentSession(activeSessionRef, sessionKey, token) &&
        countRequestIdRef.current === requestId
      ) {
        setState((current) => ({
          ...(current.sessionKey === sessionKey
            ? current
            : createEmptyState(sessionKey)),

          unreadCount: response.unreadCount,

          unreadCountError: "",
        }))
      }

      return true
    } catch (error) {
      if (
        mountedRef.current &&
        isCurrentSession(activeSessionRef, sessionKey, token) &&
        countRequestIdRef.current === requestId
      ) {
        setState((current) => ({
          ...(current.sessionKey === sessionKey
            ? current
            : createEmptyState(sessionKey)),

          unreadCountError: getErrorMessage(
            error,

            "Could not load the unread notification count.",
          ),
        }))

        if (
          error?.status === 401 &&
          localStorage.getItem(TOKEN_KEY) === token
        ) {
          logoutRef.current()
        }
      }

      return false
    }
  }, [sessionKey, token])

  const markNotificationAsRead = useCallback(
    async (notificationId) => {
      if (
        !isCurrentSession(activeSessionRef, sessionKey, token) ||
        !notificationId
      ) {
        return false
      }

      const current = stateRef.current
      const notification = current.notifications.find(
        (item) => item.id === notificationId,
      )
      const operationKey = `${sessionKey}|${notificationId}`

      if (
        current.sessionKey !== sessionKey ||
        !notification ||
        notification.isRead ||
        activeBulkOperationsRef.current.has(sessionKey) ||
        activeItemOperationsRef.current.has(operationKey)
      ) {
        return false
      }

      activeItemOperationsRef.current.add(operationKey)
      setState((previous) =>
        previous.sessionKey === sessionKey
          ? {
              ...previous,
              readingIds: [...previous.readingIds, notificationId],
              actionError: "",
            }
          : previous,
      )

      try {
        const response = await apiRequest(
          `notifications/${encodeURIComponent(notificationId)}/read`,
          { method: "PATCH", token },
        )
        if (
          response?.notification?.id !== notificationId ||
          response.notification.isRead !== true
        ) {
          throw new Error(
            "The notifications service returned an invalid read response.",
          )
        }

        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          listRequestIdRef.current += 1
          countRequestIdRef.current += 1
          setState((previous) => {
            if (previous.sessionKey !== sessionKey) return previous
            const currentNotification = previous.notifications.find(
              (item) => item.id === notificationId,
            )
            const shouldDecrement = currentNotification?.isRead === false

            return {
              ...previous,
              notifications: previous.notifications.map((item) =>
                item.id === notificationId ? response.notification : item,
              ),
              unreadCount: shouldDecrement
                ? Math.max(0, previous.unreadCount - 1)
                : previous.unreadCount,
              notificationsError: "",
              unreadCountError: "",
            }
          })
        }
        return true
      } catch (error) {
        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          setState((previous) =>
            previous.sessionKey === sessionKey
              ? {
                  ...previous,
                  actionError: getErrorMessage(
                    error,
                    "Could not mark the notification as read.",
                  ),
                }
              : previous,
          )
          if (
            error?.status === 401 &&
            localStorage.getItem(TOKEN_KEY) === token
          ) {
            logoutRef.current()
          }
        }
        return false
      } finally {
        activeItemOperationsRef.current.delete(operationKey)
        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          setState((previous) =>
            previous.sessionKey === sessionKey
              ? {
                  ...previous,
                  readingIds: previous.readingIds.filter(
                    (id) => id !== notificationId,
                  ),
                }
              : previous,
          )
        }
      }
    },
    [sessionKey, token],
  )

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!isCurrentSession(activeSessionRef, sessionKey, token)) return false

    const current = stateRef.current
    const hasUnreadNotifications =
      current.unreadCount > 0 ||
      current.notifications.some((notification) => !notification.isRead)
    const hasActiveItemOperation = [...activeItemOperationsRef.current].some(
      (key) => key.startsWith(`${sessionKey}|`),
    )

    if (current.sessionKey !== sessionKey) return false

    if (
      !hasUnreadNotifications ||
      activeBulkOperationsRef.current.has(sessionKey) ||
      hasActiveItemOperation
    ) {
      return !hasUnreadNotifications
    }

    activeBulkOperationsRef.current.add(sessionKey)
    setState((previous) =>
      previous.sessionKey === sessionKey
        ? { ...previous, markingAllAsRead: true, actionError: "" }
        : previous,
    )

    try {
      const response = await apiRequest("notifications/read-all", {
        method: "PATCH",
        token,
      })
      if (
        !Number.isSafeInteger(response?.modifiedCount) ||
        response.modifiedCount < 0
      ) {
        throw new Error(
          "The notifications service returned an invalid read-all response.",
        )
      }

      if (isCurrentSession(activeSessionRef, sessionKey, token)) {
        listRequestIdRef.current += 1
        countRequestIdRef.current += 1
        setState((previous) =>
          previous.sessionKey === sessionKey
            ? {
                ...previous,
                notifications: previous.notifications.map((notification) => ({
                  ...notification,
                  isRead: true,
                })),
                unreadCount: 0,
                notificationsError: "",
                unreadCountError: "",
              }
            : previous,
        )
      }
      return true
    } catch (error) {
      if (isCurrentSession(activeSessionRef, sessionKey, token)) {
        setState((previous) =>
          previous.sessionKey === sessionKey
            ? {
                ...previous,
                actionError: getErrorMessage(
                  error,
                  "Could not mark all notifications as read.",
                ),
              }
            : previous,
        )
        if (
          error?.status === 401 &&
          localStorage.getItem(TOKEN_KEY) === token
        ) {
          logoutRef.current()
        }
      }
      return false
    } finally {
      activeBulkOperationsRef.current.delete(sessionKey)
      if (isCurrentSession(activeSessionRef, sessionKey, token)) {
        setState((previous) =>
          previous.sessionKey === sessionKey
            ? { ...previous, markingAllAsRead: false }
            : previous,
        )
      }
    }
  }, [sessionKey, token])

  const deleteNotification = useCallback(
    async (notificationId) => {
      if (
        !isCurrentSession(activeSessionRef, sessionKey, token) ||
        !notificationId
      ) {
        return false
      }

      const current = stateRef.current
      const notification = current.notifications.find(
        (item) => item.id === notificationId,
      )
      const operationKey = `${sessionKey}|${notificationId}`

      if (
        current.sessionKey !== sessionKey ||
        !notification ||
        activeBulkOperationsRef.current.has(sessionKey) ||
        activeItemOperationsRef.current.has(operationKey)
      ) {
        return false
      }

      activeItemOperationsRef.current.add(operationKey)
      setState((previous) =>
        previous.sessionKey === sessionKey
          ? {
              ...previous,
              deletingIds: [...previous.deletingIds, notificationId],
              actionError: "",
            }
          : previous,
      )

      try {
        const response = await apiRequest(
          `notifications/${encodeURIComponent(notificationId)}`,
          { method: "DELETE", token },
        )
        if (response?.message !== "Notification deleted.") {
          throw new Error(
            "The notifications service returned an invalid delete response.",
          )
        }

        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          listRequestIdRef.current += 1
          countRequestIdRef.current += 1
          const currentPage = currentPageRef.current
          const previous = stateRef.current
          const existing = previous.notifications.find(
            (item) => item.id === notificationId,
          )
          const notifications = previous.notifications.filter(
            (item) => item.id !== notificationId,
          )
          const total = Math.max(0, previous.pagination.total - 1)
          const totalPages = Math.ceil(total / previous.pagination.limit)
          const shouldMoveToPreviousPage = currentPage > totalPages && total > 0
          const nextPage = shouldMoveToPreviousPage
            ? Math.min(currentPage, totalPages)
            : currentPage
          const expectedOnPage = Math.min(
            previous.pagination.limit,
            Math.max(0, total - (nextPage - 1) * previous.pagination.limit),
          )
          const shouldRefetchPage =
            shouldMoveToPreviousPage || notifications.length < expectedOnPage
          const nextState = {
            ...previous,
            notifications,
            unreadCount:
              existing?.isRead === false
                ? Math.max(0, previous.unreadCount - 1)
                : previous.unreadCount,
            pagination: {
              ...previous.pagination,
              page: nextPage,
              total,
              totalPages,
            },
            notificationsError: "",
            unreadCountError: "",
          }
          setState(nextState)

          if (shouldRefetchPage) {
            currentPageRef.current = nextPage
            await fetchNotifications(nextPage)
          }
        }
        return true
      } catch (error) {
        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          setState((previous) =>
            previous.sessionKey === sessionKey
              ? {
                  ...previous,
                  actionError: getErrorMessage(
                    error,
                    "Could not delete the notification.",
                  ),
                }
              : previous,
          )
          if (
            error?.status === 401 &&
            localStorage.getItem(TOKEN_KEY) === token
          ) {
            logoutRef.current()
          }
        }
        return false
      } finally {
        activeItemOperationsRef.current.delete(operationKey)
        if (isCurrentSession(activeSessionRef, sessionKey, token)) {
          setState((previous) =>
            previous.sessionKey === sessionKey
              ? {
                  ...previous,
                  deletingIds: previous.deletingIds.filter(
                    (id) => id !== notificationId,
                  ),
                }
              : previous,
          )
        }
      }
    },
    [fetchNotifications, sessionKey, token],
  )

  const refreshNotifications = useCallback(
    () =>
      Promise.all([
        fetchNotifications(currentPageRef.current),

        refreshUnreadCount(),
      ]),

    [fetchNotifications, refreshUnreadCount],
  )

  useEffect(() => {
    mountedRef.current = true

    currentPageRef.current = 1

    if (!isCurrentSession(activeSessionRef, sessionKey, token)) {
      listRequestIdRef.current += 1

      countRequestIdRef.current += 1

      setState(createEmptyState())
    } else {
      setState({ ...createEmptyState(sessionKey), loading: true })

      void fetchNotifications(1)

      void refreshUnreadCount()
    }

    return () => {
      mountedRef.current = false

      listRequestIdRef.current += 1

      countRequestIdRef.current += 1
    }
  }, [fetchNotifications, refreshUnreadCount, sessionKey, token])

  useEffect(() => {
    seenSocketNotificationIdsRef.current.clear()
  }, [sessionKey])

  useEffect(() => {
    if (!socket || !sessionKey || !token) return undefined

    let connectedBefore = Boolean(socket.connected)

    const handleConnect = () => {
      if (
        connectedBefore &&
        isCurrentSession(activeSessionRef, sessionKey, token)
      ) {
        void refreshNotifications()
      }

      connectedBefore = true
    }

    const handleNotificationCreated = (notification) => {
      if (
        !mountedRef.current ||
        !isCurrentSession(activeSessionRef, sessionKey, token) ||
        notification?.userId !== userId ||
        typeof notification?.id !== "string" ||
        notification.isRead !== false ||
        seenSocketNotificationIdsRef.current.has(notification.id)
      ) {
        return
      }

      const seenIds = seenSocketNotificationIdsRef.current
      seenIds.add(notification.id)
      if (seenIds.size > 500) {
        seenIds.delete(seenIds.values().next().value)
      }

      listRequestIdRef.current += 1
      countRequestIdRef.current += 1
      setState((current) =>
        current.sessionKey === sessionKey
          ? {
              ...current,
              unreadCount: Math.max(0, current.unreadCount + 1),
              unreadCountError: "",
            }
          : current,
      )
      void refreshNotifications()
    }

    socket.on("connect", handleConnect)
    socket.on("notification:created", handleNotificationCreated)

    return () => {
      socket.off("connect", handleConnect)
      socket.off("notification:created", handleNotificationCreated)
    }
  }, [refreshNotifications, sessionKey, socket, token, userId])

  const currentState =
    state.sessionKey === sessionKey ? state : createEmptyState(sessionKey)

  const value = useMemo(
    () => ({
      notifications: currentState.notifications,

      unreadCount: currentState.unreadCount,

      pagination: currentState.pagination,

      loading: sessionKey
        ? currentState.loading || state.sessionKey !== sessionKey
        : false,

      error: currentState.notificationsError || currentState.unreadCountError,

      actionError: currentState.actionError,

      readingIds: currentState.readingIds,

      deletingIds: currentState.deletingIds,

      markingAllAsRead: currentState.markingAllAsRead,

      fetchNotifications,

      refreshNotifications,

      refreshUnreadCount,

      markNotificationAsRead,

      markAllNotificationsAsRead,

      deleteNotification,
    }),

    [
      currentState,

      fetchNotifications,

      refreshNotifications,

      refreshUnreadCount,

      markNotificationAsRead,

      markAllNotificationsAsRead,

      deleteNotification,

      sessionKey,

      state.sessionKey,
    ],
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    )
  }

  return context
}

export default NotificationProvider
