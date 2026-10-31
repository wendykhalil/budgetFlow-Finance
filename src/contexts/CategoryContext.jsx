import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest } from '@/lib/api'

const CategoryContext = createContext(null)

function categoriesEqual(left, right) {
  return left.length === right.length && left.every((category, index) => {
    const other = right[index]
    const keys = new Set([...Object.keys(category), ...Object.keys(other)])
    return [...keys].every((key) => category[key] === other[key])
  })
}

function sortCategories(categories) {
  return [...categories].sort((left, right) =>
    left.type.localeCompare(right.type) || left.name.localeCompare(right.name),
  )
}

function applyCategoryAction(categories, action) {
  const index = categories.findIndex((category) => category.id === action.id)
  if (action.type === 'remove' || action.category.isArchived) {
    return index === -1
      ? categories
      : categories.filter((category) => category.id !== action.id)
  }

  if (index !== -1 && categoriesEqual([categories[index]], [action.category])) {
    return categories
  }
  const updated = index === -1
    ? [...categories, action.category]
    : categories.map((category, itemIndex) =>
        itemIndex === index ? action.category : category,
      )
  return sortCategories(updated)
}

export function CategoryProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.role === 'client' ? user.id : null
  const token = localStorage.getItem('budgetflow_token')
  const sessionKey = userId && token ? `${userId}:${token}` : null
  const [state, setState] = useState({
    sessionKey: null,
    categories: [],
    loading: false,
    error: '',
  })
  const activeSessionRef = useRef(sessionKey)
  const requestRef = useRef(null)
  const sequenceRef = useRef(0)
  const actionsRef = useRef([])

  activeSessionRef.current = sessionKey

  const refreshCategories = useCallback(() => {
    if (!sessionKey || !token) return Promise.resolve(false)

    if (requestRef.current?.sessionKey === sessionKey) {
      return requestRef.current.promise
    }

    const requestSequence = sequenceRef.current
    setState((current) => ({
      sessionKey,
      categories: current.sessionKey === sessionKey ? current.categories : [],
      loading: true,
      error: '',
    }))

    const request = apiRequest('categories', { token })
      .then((response) => {
        if (!Array.isArray(response?.categories)) {
          throw new Error('The categories service returned an invalid response.')
        }
        if (activeSessionRef.current === sessionKey) {
          const actions = actionsRef.current.filter(
            (action) => action.sessionKey === sessionKey && action.sequence > requestSequence,
          )
          const nextCategories = actions.reduce(
            (current, action) => applyCategoryAction(current, action),
            sortCategories(response.categories),
          )
          setState((current) => {
            if (activeSessionRef.current !== sessionKey) return current
            return {
              sessionKey,
              categories: categoriesEqual(current.categories, nextCategories)
                ? current.categories
                : nextCategories,
              loading: current.sessionKey === sessionKey ? current.loading : false,
              error: '',
            }
          })
        }
        actionsRef.current = actionsRef.current.filter(
          (action) => action.sessionKey !== sessionKey || action.sequence > sequenceRef.current,
        )
        return true
      })
      .catch((requestError) => {
        if (activeSessionRef.current === sessionKey) {
          setState((current) => ({
            ...current,
            sessionKey,
            error: requestError.message || 'Could not load categories.',
          }))
        }
        return false
      })
      .finally(() => {
        if (activeSessionRef.current === sessionKey) {
          setState((current) => current.sessionKey === sessionKey
            ? { ...current, loading: false }
            : current)
        }
        if (requestRef.current?.promise === request) requestRef.current = null
      })

    requestRef.current = { sessionKey, promise: request }
    return request
  }, [sessionKey, token])

  const recordAction = useCallback((action) => {
    const sequencedAction = {
      ...action,
      sessionKey,
      sequence: ++sequenceRef.current,
    }
    if (requestRef.current?.sessionKey === sessionKey) {
      actionsRef.current.push(sequencedAction)
    }
    setState((current) => {
      if (activeSessionRef.current !== sessionKey || current.sessionKey !== sessionKey) {
        return current
      }
      const categories = applyCategoryAction(current.categories, sequencedAction)
      return categories === current.categories
        ? current
        : { ...current, categories }
    })
  }, [sessionKey])

  const requireSession = useCallback(() => {
    if (!sessionKey || !token) {
      throw new Error('Sign in to manage categories.')
    }
  }, [sessionKey, token])

  const createCategory = useCallback(async (data) => {
    requireSession()
    const response = await apiRequest('categories', {
      method: 'POST',
      token,
      body: data,
    })
    if (!response?.category?.id) {
      throw new Error('The categories service returned an invalid response.')
    }
    if (activeSessionRef.current === sessionKey) {
      recordAction({
        type: 'upsert',
        id: response.category.id,
        category: response.category,
      })
    }
    return response.category
  }, [recordAction, requireSession, sessionKey, token])

  const updateCategory = useCallback(async (id, data) => {
    requireSession()
    const response = await apiRequest(`categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      token,
      body: data,
    })
    if (!response?.category?.id) {
      throw new Error('The categories service returned an invalid response.')
    }
    if (activeSessionRef.current === sessionKey) {
      recordAction({
        type: 'upsert',
        id: response.category.id,
        category: response.category,
      })
    }
    return response.category
  }, [recordAction, requireSession, sessionKey, token])

  const deleteCategory = useCallback(async (id) => {
    requireSession()
    const response = await apiRequest(`categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    })
    const categoryId = response?.category?.id || response?.categoryId
    if (!categoryId || !['deleted', 'archived'].includes(response?.action)) {
      throw new Error('The categories service returned an invalid response.')
    }
    if (activeSessionRef.current === sessionKey) {
      recordAction({ type: 'remove', id: categoryId })
    }
    return response
  }, [recordAction, requireSession, sessionKey, token])

  useEffect(() => {
    if (!sessionKey || !token) {
      actionsRef.current = []
      setState((current) => current.sessionKey === null &&
        current.categories.length === 0 &&
        !current.loading &&
        !current.error
        ? current
        : { sessionKey: null, categories: [], loading: false, error: '' })
      return undefined
    }

    activeSessionRef.current = sessionKey
    setState((current) => current.sessionKey === sessionKey
      ? current
      : { sessionKey, categories: [], loading: true, error: '' })
    refreshCategories()

    return () => {
      if (activeSessionRef.current === sessionKey) {
        activeSessionRef.current = null
      }
    }
  }, [refreshCategories, sessionKey, token])

  const value = useMemo(() => ({
    categories: state.sessionKey === sessionKey ? state.categories : [],
    loading: state.sessionKey === sessionKey ? state.loading : Boolean(sessionKey),
    error: state.sessionKey === sessionKey ? state.error : '',
    refreshCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }), [
    state,
    sessionKey,
    refreshCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  ])

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategories() {
  const context = useContext(CategoryContext)
  if (!context) {
    throw new Error('useCategories must be used within a CategoryProvider')
  }
  return context
}

export default CategoryProvider
