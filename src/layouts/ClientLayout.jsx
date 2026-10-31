import { useCallback, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import TransactionProvider from '@/contexts/TransactionContext'
import CategoryProvider from '@/contexts/CategoryContext'

export function ClientLayout() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)

  const closeMobileMenu = useCallback((restoreFocus = true) => {
    setMobileMenuOpen(false)
    if (restoreFocus) menuButtonRef.current?.focus()
  }, [])

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (user.role !== 'client') {
    return <Navigate to="/unauthorized" replace />
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
    <div className="min-h-screen min-w-0 bg-[#F4F7F6] text-slate-900">
      <Sidebar
        navItems={clientNav}
        role="client"
        mobileOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
      <div className="min-w-0 lg:pl-64">
        <Header
          role="client"
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          menuButtonRef={menuButtonRef}
        />
        <TransactionProvider>
          <CategoryProvider>
            <main className="p-4 md:p-7 lg:p-8">
              <Outlet />
            </main>
          </CategoryProvider>
        </TransactionProvider>
      </div>
    </div>
  )
}

export default ClientLayout
