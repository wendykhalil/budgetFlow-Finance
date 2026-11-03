import { useEffect, useState } from "react"
import { getAnalytics } from "@/lib/analyticsApi"
import { useAuth } from "@/contexts/AuthContext"

const TOKEN_KEY = "budgetflow_token"

/**
 * Hook pour récupérer et gérer les données Analytics
 * @returns {object} { data, loading, error, refetch }
 */
export function useAnalytics() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem(TOKEN_KEY)
      const result = await getAnalytics({ token })
      setData(result)
    } catch (err) {
      setError(err.message || "Failed to load analytics")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchAnalytics()
    }
  }, [user?.id])

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  }
}
