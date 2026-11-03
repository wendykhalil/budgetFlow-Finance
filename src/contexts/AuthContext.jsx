import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { io } from "socket.io-client"
import { apiRequest, getSocketBaseUrl } from "@/lib/api"
import { normalizeCurrency, SUPPORTED_CURRENCIES } from "@/utils/currencies"

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

// Keep sign-in across reloads without persisting user credentials.
const TOKEN_KEY = "budgetflow_token"
const LEGACY_SESSION_KEY = "budgetflow_session"
const LEGACY_USERS_KEY = "budgetflow_users"

function removeLegacyAuthData() {
  localStorage.removeItem(LEGACY_SESSION_KEY)
  localStorage.removeItem(LEGACY_USERS_KEY)
}

function getAuthUser(user) {
  const initials = [user.firstName, user.lastName]
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim()[0])
    .join("")
    .toUpperCase()

  return {
    ...user,
    phone: user.phone || "",
    country: user.country || "",
    currency: normalizeCurrency(user.currency || "EUR"),
    avatar: user.avatar || initials,
    avatarColor: user.avatarColor || "blue",
  }
}

function readAuthResponse(response) {
  if (!response?.token || !response.user || !response.user.role) {
    throw new Error("The authentication service returned an invalid response.")
  }
  return { token: response.token, user: getAuthUser(response.user) }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [socketState, setSocketState] = useState({
    userId: null,
    token: null,
    socket: null,
  })
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState("")
  const tokenRef = useRef(token)
  const socketRef = useRef(null)
  const sessionRef = useRef({ userId: null, token: null })
  const profileRequestIdRef = useRef(0)
  tokenRef.current = token
  sessionRef.current = {
    userId: user?.id || null,
    token,
  }
  const socket =
    socketState.userId === user?.id && socketState.token === token
      ? socketState.socket
      : null

  const disconnectSocket = () => {
    const activeSocket = socketRef.current
    if (!activeSocket) return

    activeSocket.socket.off("connect", activeSocket.handleConnect)
    activeSocket.socket.off(
      "account:currency-updated",
      activeSocket.handleCurrencyUpdated,
    )
    activeSocket.socket.disconnect()
    socketRef.current = null
  }

  const refreshCurrentUser = useCallback(
    async (expectedUserId, expectedToken) => {
      if (
        !expectedUserId ||
        !expectedToken ||
        tokenRef.current !== expectedToken ||
        localStorage.getItem(TOKEN_KEY) !== expectedToken
      ) {
        return null
      }

      const requestId = ++profileRequestIdRef.current

      try {
        const response = await apiRequest("auth/me", { token: expectedToken })
        if (
          profileRequestIdRef.current !== requestId ||
          !response?.user ||
          response.user.id !== expectedUserId ||
          sessionRef.current.userId !== expectedUserId ||
          sessionRef.current.token !== expectedToken ||
          tokenRef.current !== expectedToken ||
          localStorage.getItem(TOKEN_KEY) !== expectedToken
        ) {
          return null
        }

        const refreshedUser = getAuthUser(response.user)
        setUser(refreshedUser)
        setAuthError("")
        return refreshedUser
      } catch (error) {
        if (profileRequestIdRef.current !== requestId) return null

        if (
          sessionRef.current.userId === expectedUserId &&
          sessionRef.current.token === expectedToken
        ) {
          if (error.status === 401) {
            profileRequestIdRef.current += 1
            sessionRef.current = { userId: null, token: null }
            disconnectSocket()
            localStorage.removeItem(TOKEN_KEY)
            tokenRef.current = null
            setToken(null)
            setUser(null)
            setLoading(false)
          }
          setAuthError(
            error.message || "Could not refresh your account profile.",
          )
        }
        return null
      }
    },
    [],
  )

  useEffect(() => {
    let isMounted = true
    removeLegacyAuthData()

    async function restoreSession(expectedToken) {
      const requestId = ++profileRequestIdRef.current
      if (!expectedToken) {
        sessionRef.current = { userId: null, token: null }
        setUser(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const response = await apiRequest("auth/me", { token: expectedToken })
        if (!response?.user) {
          throw new Error(
            "The authentication service returned an invalid response.",
          )
        }
        if (
          isMounted &&
          profileRequestIdRef.current === requestId &&
          tokenRef.current === expectedToken &&
          localStorage.getItem(TOKEN_KEY) === expectedToken
        ) {
          const restoredUser = getAuthUser(response.user)
          sessionRef.current = {
            userId: restoredUser.id,
            token: expectedToken,
          }
          setUser(restoredUser)
          setAuthError("")
        }
      } catch (error) {
        if (
          !isMounted ||
          profileRequestIdRef.current !== requestId ||
          tokenRef.current !== expectedToken ||
          localStorage.getItem(TOKEN_KEY) !== expectedToken
        ) {
          return
        }
        if (error.status === 401) {
          sessionRef.current = { userId: null, token: null }
          localStorage.removeItem(TOKEN_KEY)
          tokenRef.current = null
          setToken(null)
        }
        setUser(null)
        setAuthError(error.message || "Could not restore your session.")
      } finally {
        if (isMounted && profileRequestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    }

    const handleStorage = (event) => {
      if (event.key !== TOKEN_KEY && event.key !== null) return

      const nextToken = localStorage.getItem(TOKEN_KEY)
      if (nextToken === tokenRef.current) return

      profileRequestIdRef.current += 1
      sessionRef.current = { userId: null, token: null }
      disconnectSocket()
      setUser(null)
      setAuthError("")
      tokenRef.current = nextToken
      setToken(nextToken)
      setLoading(Boolean(nextToken))
      void restoreSession(nextToken)
    }

    window.addEventListener("storage", handleStorage)
    const initialToken = localStorage.getItem(TOKEN_KEY)
    if (initialToken !== tokenRef.current) {
      tokenRef.current = initialToken
      setToken(initialToken)
    }
    void restoreSession(initialToken)

    return () => {
      isMounted = false
      profileRequestIdRef.current += 1
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return undefined

    if (!token) return undefined

    const userSocket = io(getSocketBaseUrl(), {
      auth: { token },
      autoConnect: false,
      reconnection: true,
    })
    const handleConnect = () => {
      refreshCurrentUser(user.id, token)
    }
    const handleCurrencyUpdated = (event) => {
      if (
        !SUPPORTED_CURRENCIES.some(({ code }) => code === event?.currency) ||
        sessionRef.current.userId !== user.id ||
        sessionRef.current.token !== token ||
        tokenRef.current !== token ||
        localStorage.getItem(TOKEN_KEY) !== token
      ) {
        return
      }
      setUser((currentUser) =>
        currentUser?.id === user.id
          ? { ...currentUser, currency: event.currency }
          : currentUser,
      )
    }

    userSocket.on("connect", handleConnect)
    userSocket.on("account:currency-updated", handleCurrencyUpdated)
    socketRef.current = {
      socket: userSocket,
      handleConnect,
      handleCurrencyUpdated,
    }
    setSocketState({ userId: user.id, token, socket: userSocket })
    userSocket.connect()

    return () => {
      if (socketRef.current?.socket === userSocket) disconnectSocket()
      setSocketState((currentState) =>
        currentState.socket === userSocket
          ? { userId: null, token: null, socket: null }
          : currentState,
      )
    }
  }, [refreshCurrentUser, user?.id, token])

  const login = async (email, password) => {
    const response = await apiRequest("auth/login", {
      method: "POST",
      body: { email, password },
    })
    const result = readAuthResponse(response)
    removeLegacyAuthData()
    profileRequestIdRef.current += 1
    disconnectSocket()
    localStorage.setItem(TOKEN_KEY, result.token)
    tokenRef.current = result.token
    setToken(result.token)
    sessionRef.current = { userId: result.user.id, token: result.token }
    setUser(result.user)
    setAuthError("")
    return { success: true, user: result.user }
  }

  const logout = () => {
    profileRequestIdRef.current += 1
    sessionRef.current = { userId: null, token: null }
    disconnectSocket()
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    tokenRef.current = null
    setToken(null)
    removeLegacyAuthData()
    setAuthError("")
  }

  const updateProfile = async (profile) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!user?.id || !token) {
      throw new Error(
        "Your session has expired. Sign in again to update profile.",
      )
    }

    let response
    try {
      response = await apiRequest("auth/profile", {
        method: "PATCH",
        token,
        body: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          country: profile.country,
        },
      })
    } catch (error) {
      if (error.status === 401 && localStorage.getItem(TOKEN_KEY) === token) {
        logout()
      }
      throw error
    }
    if (
      !response?.user ||
      response.user.id !== user.id ||
      sessionRef.current.userId !== user.id ||
      sessionRef.current.token !== token ||
      localStorage.getItem(TOKEN_KEY) !== token
    ) {
      throw new Error(
        "The account service returned an invalid profile response.",
      )
    }

    const updatedUser = getAuthUser(response.user)
    profileRequestIdRef.current += 1
    setUser(updatedUser)
    return updatedUser
  }

  const updateCurrency = async (currency) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!user?.id || !token) {
      throw new Error(
        "Your session has expired. Sign in again to update currency.",
      )
    }

    let response
    try {
      response = await apiRequest("auth/currency", {
        method: "PATCH",
        token,
        body: { currency },
      })
    } catch (error) {
      if (error.status === 401 && localStorage.getItem(TOKEN_KEY) === token) {
        logout()
      }
      throw error
    }
    if (
      !response?.user ||
      response.user.id !== user.id ||
      sessionRef.current.userId !== user.id ||
      sessionRef.current.token !== token ||
      localStorage.getItem(TOKEN_KEY) !== token
    ) {
      throw new Error(
        "The account service returned an invalid profile response.",
      )
    }

    const updatedUser = getAuthUser(response.user)
    profileRequestIdRef.current += 1
    setUser(updatedUser)
    return updatedUser
  }

  const register = async (formData) => {
    const response = await apiRequest("auth/register", {
      method: "POST",
      body: {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || "",
        password: formData.password,
        currency: formData.currency || "EUR",
        country: formData.country || "France",
      },
    })
    const result = readAuthResponse(response)
    removeLegacyAuthData()
    profileRequestIdRef.current += 1
    disconnectSocket()
    localStorage.setItem(TOKEN_KEY, result.token)
    tokenRef.current = result.token
    setToken(result.token)
    sessionRef.current = { userId: result.user.id, token: result.token }
    setUser(result.user)
    setAuthError("")
    return { success: true, user: result.user }
  }

  const value = {
    user,
    socket,
    loading,
    authError,
    login,
    logout,
    updateProfile,
    updateCurrency,
    refreshUser: () =>
      user?.id
        ? refreshCurrentUser(user.id, localStorage.getItem(TOKEN_KEY))
        : Promise.resolve(null),
    register,
    isAuthenticated: !!user,
    isClient: user?.role === "client",
    isAdmin: user?.role === "admin",
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
