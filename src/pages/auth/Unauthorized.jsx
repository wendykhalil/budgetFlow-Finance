import { Link } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'

export function Unauthorized() {
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
            You don't have permission to view this page. This area is restricted
            to administrators.
          </p>
          <div className="mt-8">
            <Button as={Link} to="/client/dashboard" className="w-full">
              Go to client dashboard
            </Button>
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
