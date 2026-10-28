import { createContext, useContext, useEffect, useState } from 'react'
import { demoAccounts, findUserByEmail } from '@/data/mockUsers'
import { getRegisteredUsers, saveRegisteredUsers } from '@/data/registeredUsers'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

const SESSION_KEY = 'budgetflow_session'

const getUserFromStorage = (email, password) => {
  const users = getRegisteredUsers()
  return users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password)
}

const getDemoUser = (email, password) => {
  const account = Object.values(demoAccounts).find(
    (demo) => demo.email === email && demo.password === password,
  )
  if (!account) return null

  const profileEmail = account.role === 'admin' ? 'john.s@example.com' : 'alex.martin@example.com'
  const user = findUserByEmail(profileEmail)
  return user ? { ...user, role: account.role } : null
}

const getAuthUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone || '',
  country: user.country || '',
  currency: user.currency || 'EUR',
  role: user.role,
  avatar: user.avatar,
  avatarColor: user.avatarColor,
})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY)
    if (session) {
      try {
        const parsed = JSON.parse(session)
        const storedUser =
          getUserFromStorage(parsed.email, parsed.password) ||
          getDemoUser(parsed.email, parsed.password)
        if (storedUser) setUser(getAuthUser(storedUser))
      } catch {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = (email, password) => {
    const storedUser = getUserFromStorage(email, password)
    if (storedUser) {
      const userData = {
        id: storedUser.id,
        firstName: storedUser.firstName,
        lastName: storedUser.lastName,
        email: storedUser.email,
        phone: storedUser.phone || '',
        country: storedUser.country || '',
        currency: storedUser.currency || 'EUR',
        role: storedUser.role,
        avatar: storedUser.avatar,
        avatarColor: storedUser.avatarColor,
      }
      setUser(userData)
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email, password }))
      return { success: true, user: userData }
    }

    const demoUser = getDemoUser(email, password)
    if (demoUser) {
      const userData = getAuthUser(demoUser)
      setUser(userData)
      localStorage.setItem(SESSION_KEY, JSON.stringify({ email, password }))
      return { success: true, user: userData }
    }

    return { success: false, error: 'Invalid email or password' }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
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

  const register = (formData) => {
    const users = getRegisteredUsers()
    const email = formData.email.trim().toLowerCase()
    if (users.some((u) => u.email.toLowerCase() === email) || findUserByEmail(email)) {
      return { success: false, error: 'Email already registered' }
    }
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email,
      phone: formData.phone || '',
      password: formData.password,
      role: 'client',
      status: 'active',
      currency: formData.currency || 'EUR',
      country: formData.country || 'France',
      avatar: `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase(),
      avatarColor: 'blue',
      joinedAt: new Date().toISOString(),
      transactionsCount: 0,
    }
    users.push(newUser)
    saveRegisteredUsers(users)
    return { success: true, user: newUser }
  }

  const value = {
    user,
    loading,
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
