import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from '@/pages/auth/Landing'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Unauthorized from '@/pages/auth/Unauthorized'

import ClientLayout from '@/layouts/ClientLayout'
import AdminLayout from '@/layouts/AdminLayout'
import AuthLayout from '@/layouts/AuthLayout'

import ClientDashboard from '@/pages/client/Dashboard'
import ClientTransactions from '@/pages/client/Transactions'
import ClientTransactionNew from '@/pages/client/TransactionNew'
import ClientTransactionDetails from '@/pages/client/TransactionDetails'
import ClientBudgets from '@/pages/client/Budgets'
import ClientBudgetNew from '@/pages/client/BudgetNew'
import ClientBudgetDetails from '@/pages/client/BudgetDetails'
import ClientCategories from '@/pages/client/Categories'
import ClientAnalytics from '@/pages/client/Analytics'
import ClientCalendar from '@/pages/client/Calendar'
import ClientNotifications from '@/pages/client/Notifications'
import ClientProfile from '@/pages/client/Profile'
import ClientSettings from '@/pages/client/Settings'

import AdminDashboard from '@/pages/admin/Dashboard'
import AdminUsers from '@/pages/admin/Users'
import AdminUserDetail from '@/pages/admin/UserDetail'
import AdminTransactions from '@/pages/admin/Transactions'
import AdminCategories from '@/pages/admin/Categories'
import AdminBudgets from '@/pages/admin/Budgets'
import AdminReports from '@/pages/admin/Reports'
import AdminActivityLogs from '@/pages/admin/ActivityLogs'
import AdminSettings from '@/pages/admin/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route path="/unauthorized" element={<Unauthorized />}>
        <Route index element={<Unauthorized />} />
      </Route>

      <Route element={<ClientLayout />}>
        <Route path="/client/dashboard" element={<ClientDashboard />} />
        <Route path="/client/transactions" element={<ClientTransactions />} />
        <Route path="/client/transactions/new" element={<ClientTransactionNew />} />
        <Route path="/client/transactions/:id" element={<ClientTransactionDetails />} />
        <Route path="/client/budgets" element={<ClientBudgets />} />
        <Route path="/client/budgets/new" element={<ClientBudgetNew />} />
        <Route path="/client/budgets/:id" element={<ClientBudgetDetails />} />
        <Route path="/client/categories" element={<ClientCategories />} />
        <Route path="/client/analytics" element={<ClientAnalytics />} />
        <Route path="/client/calendar" element={<ClientCalendar />} />
        <Route path="/client/notifications" element={<ClientNotifications />} />
        <Route path="/client/profile" element={<ClientProfile />} />
        <Route path="/client/settings" element={<ClientSettings />} />
        <Route index element={<Navigate to="/client/dashboard" replace />} />
      </Route>

      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/users/:id" element={<AdminUserDetail />} />
        <Route path="/admin/transactions" element={<AdminTransactions />} />
        <Route path="/admin/categories" element={<AdminCategories />} />
        <Route path="/admin/budgets" element={<AdminBudgets />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
