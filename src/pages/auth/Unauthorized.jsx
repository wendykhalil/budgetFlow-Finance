import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Unauthorized() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const destination =
    user?.role === 'admin'
      ? { path: '/admin/dashboard', label: 'Go to admin dashboard' }
      : user?.role === 'client'
        ? { path: '/client/dashboard', label: 'Go to client dashboard' }
        : { path: '/login', label: 'Sign in' }

  return (
    <main className="min-h-screen bg-[#F4F7F6]">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Access denied
          </h1>
          <p className="mt-3 text-slate-500">
            You don't have permission to view this page.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => navigate(destination.path)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#155C4F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#104B41]"
            >
              {destination.label}
            </button>
          </div>
          <button
            onClick={() => window.history.back()}
            className="mt-4 text-sm font-semibold text-[#155C4F]"
          >
            Go back
          </button>
        </div>
      </div>
    </main>
  )
}

export default Unauthorized
