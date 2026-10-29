import { createContext, useContext, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Keep sign-in across reloads without persisting user credentials.
const TOKEN_KEY = 'budgetflow_token'
const LEGACY_SESSION_KEY = 'budgetflow_session'
const LEGACY_USERS_KEY = 'budgetflow_users'

function removeLegacyAuthData() {
  localStorage.removeItem(LEGACY_SESSION_KEY)
  localStorage.removeItem(LEGACY_USERS_KEY)
}

function getAuthUser(user) {
  const initials = [user.firstName, user.lastName]
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => name.trim()[0])
    .join('')
    .toUpperCase()

  return {
    ...user,
    phone: user.phone || '',
    country: user.country || '',
    currency: user.currency || 'EUR',
    avatar: user.avatar || initials,
    avatarColor: user.avatarColor || 'blue',
  }
}

function readAuthResponse(response) {
  if (!response?.token || !response.user || !response.user.role) {
    throw new Error('The authentication service returned an invalid response.')
  }
  return { token: response.token, user: getAuthUser(response.user) }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

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
        const response = await apiRequest('auth/me', { token })
        if (!response?.user) {
          throw new Error('The authentication service returned an invalid response.')
        }
        if (isMounted) {
          setUser(getAuthUser(response.user))
          setAuthError('')
        }
      } catch (error) {
        if (!isMounted) return
        if (error.status === 401) {
          localStorage.removeItem(TOKEN_KEY)
        }
        setUser(null)
        setAuthError(error.message || 'Could not restore your session.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    restoreSession()
    return () => {
      isMounted = false
    }
  }, [])

  const login = async (email, password) => {
    const response = await apiRequest('auth/login', {
      method: 'POST',
      body: { email, password },
    })
    const result = readAuthResponse(response)
    removeLegacyAuthData()
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser(result.user)
    setAuthError('')
    return { success: true, user: result.user }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    removeLegacyAuthData()
    setAuthError('')
  }

  const updateProfile = (profile) => {
    setUser((currentUser) => currentUser ? {
      ...currentUser,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      country: profile.country,
      avatar: `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase(),
    } : currentUser)
  }

  const register = async (formData) => {
    const response = await apiRequest('auth/register', {
      method: 'POST',
      body: {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || '',
        password: formData.password,
        currency: formData.currency || 'EUR',
        country: formData.country || 'France',
      },
    })
    const result = readAuthResponse(response)
    removeLegacyAuthData()
    localStorage.setItem(TOKEN_KEY, result.token)
    setUser(result.user)
    setAuthError('')
    return { success: true, user: result.user }
  }

  const value = {
    user,
    loading,
    authError,
    login,
    logout,
    updateProfile,
    register,
    isAuthenticated: !!user,
    isClient: user?.role === 'client',
    isAdmin: user?.role === 'admin',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
