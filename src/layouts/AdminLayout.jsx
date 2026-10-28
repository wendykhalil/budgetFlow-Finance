import { useCallback, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export function AdminLayout() {
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

  if (user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />
  }

  const adminNav = [
    { name: 'Dashboard', icon: 'grid', path: '/admin/dashboard' },
    { name: 'Users', icon: 'users', path: '/admin/users' },
    { name: 'Transactions', icon: 'card', path: '/admin/transactions' },
    { name: 'Categories', icon: 'tag', path: '/admin/categories' },
    { name: 'Budgets', icon: 'wallet', path: '/admin/budgets' },
    { name: 'Reports', icon: 'report', path: '/admin/reports' },
    { name: 'Activity Logs', icon: 'activity', path: '/admin/activity-logs' },
    { name: 'Settings', icon: 'settings', path: '/admin/settings' },
  ]

  return (
    <div className="min-h-screen min-w-0 bg-[#F4F7F6] text-slate-900">
      <Sidebar
        navItems={adminNav}
        role="admin"
        mobileOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
      <div className="min-w-0 lg:pl-64">
        <Header
          role="admin"
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
          menuButtonRef={menuButtonRef}
        />
        <main className="p-4 md:p-7 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
