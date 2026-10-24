import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AuthLayout() {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (isAuthenticated) {
    const path = user?.role === 'admin' ? '/admin/dashboard' : '/client/dashboard'
    return <Navigate to={path} replace />
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6]">
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <Outlet />
      </div>
    </div>
  )
}

export default AuthLayout
