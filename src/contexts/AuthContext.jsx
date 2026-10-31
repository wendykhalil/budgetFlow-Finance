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
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState("")
  const sessionRef = useRef({ userId: null, token: null })
  sessionRef.current = {
    userId: user?.id || null,
    token: localStorage.getItem(TOKEN_KEY),
  }

  const refreshCurrentUser = useCallback(
    async (expectedUserId, expectedToken) => {
      if (
        !expectedUserId ||
        !expectedToken ||
        localStorage.getItem(TOKEN_KEY) !== expectedToken
      ) {
        return null
      }

      try {
        const response = await apiRequest("auth/me", { token: expectedToken })
        if (
          !response?.user ||
          response.user.id !== expectedUserId ||
          sessionRef.current.userId !== expectedUserId ||
          sessionRef.current.token !== expectedToken ||
          localStorage.getItem(TOKEN_KEY) !== expectedToken
        ) {
          return null
        }

        const refreshedUser = getAuthUser(response.user)
        setUser(refreshedUser)
        setAuthError("")
        return refreshedUser
      } catch (error) {
        if (
          sessionRef.current.userId === expectedUserId &&
          sessionRef.current.token === expectedToken
        ) {
          if (error.status === 401) {
            sessionRef.current = { userId: null, token: null }
            localStorage.removeItem(TOKEN_KEY)
            setUser(null)
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
    const token = localStorage.getItem(TOKEN_KEY)

    async function restoreSession() {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const response = await apiRequest("auth/me", { token })
        if (!response?.user) {
          throw new Error(
            "The authentication service returned an invalid response.",
          )
        }
        if (isMounted && localStorage.getItem(TOKEN_KEY) === token) {
          setUser(getAuthUser(response.user))
          setAuthError("")
        }
      } catch (error) {
        if (!isMounted || localStorage.getItem(TOKEN_KEY) !== token) return
        if (error.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
        }
        setUser(null)
        setAuthError(error.message || "Could not restore your session.")
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    restoreSession()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return undefined

    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return undefined

    const socket = io(getSocketBaseUrl(), {
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
        sessionRef.current.token !== token
      ) {
        return
      }
      setUser((currentUser) =>
        currentUser?.id === user.id
          ? { ...currentUser, currency: event.currency }
          : currentUser,
      )
    }

    socket.on("connect", handleConnect)
    socket.on("account:currency-updated", handleCurrencyUpdated)
    socket.connect()

    return () => {
      socket.off("connect", handleConnect)
      socket.off("account:currency-updated", handleCurrencyUpdated)
      socket.disconnect()
    }
  }, [refreshCurrentUser, user?.id])

  const login = async (email, password) => {
    const response = await apiRequest("auth/login", {
      method: "POST",
      body: { email, password },
    })
    const result = readAuthResponse(response)
    removeLegacyAuthData()
    localStorage.setItem(TOKEN_KEY, result.token)
    sessionRef.current = { userId: result.user.id, token: result.token }
    setUser(result.user)
    setAuthError("")
    return { success: true, user: result.user }
  }

  const logout = () => {
    sessionRef.current = { userId: null, token: null }
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    removeLegacyAuthData()
    setAuthError("")
  }

  const updateProfile = (profile) => {
    setUser((currentUser) =>
      currentUser
        ? {
            ...currentUser,
            firstName: profile.firstName,
            lastName: profile.lastName,
            phone: profile.phone,
            country: profile.country,
            avatar:
              `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase(),
          }
        : currentUser,
    )
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
    localStorage.setItem(TOKEN_KEY, result.token)
    sessionRef.current = { userId: result.user.id, token: result.token }
    setUser(result.user)
    setAuthError("")
    return { success: true, user: result.user }
  }

  const value = {
    user,
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
