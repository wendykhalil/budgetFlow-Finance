import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export function ClientLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  const clientNav = [
    { name: 'Dashboard', icon: 'grid', path: '/client/dashboard' },
    { name: 'Transactions', icon: 'card', path: '/client/transactions' },
    { name: 'Budgets', icon: 'wallet', path: '/client/budgets' },
    { name: 'Categories', icon: 'tag', path: '/client/categories' },
    { name: 'Analytics', icon: 'chart', path: '/client/analytics' },
    { name: 'Calendar', icon: 'calendar', path: '/client/calendar' },
    { name: 'Notifications', icon: 'bell', path: '/client/notifications' },
    { name: 'Profile', icon: 'user', path: '/client/profile' },
    { name: 'Settings', icon: 'settings', path: '/client/settings' },
  ]

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-slate-900">
      <div className="fixed inset-y-0 left-0 z-40 w-64 lg:translate-x-0">
        <Sidebar navItems={clientNav} role="client" />
      </div>
      <div className="lg:pl-64">
        <Header role="client" />
        <main className="p-4 md:p-7 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default ClientLayout
