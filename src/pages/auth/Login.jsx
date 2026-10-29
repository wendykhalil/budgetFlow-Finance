import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, authError } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const result = await login(email, password)
      const isAdmin = result.user.role === 'admin'
      const rolePrefix = isAdmin ? '/admin/' : '/client/'
      const roleHome = isAdmin ? '/admin/dashboard' : '/client/dashboard'
      const requestedPath = location.state?.from
      const path = requestedPath?.startsWith(rolePrefix) ? requestedPath : roleHome
      navigate(path, { replace: true })
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7F6]">
      <div className="container mx-auto flex min-h-screen items-center justify-center p-4">
        <div className="hidden lg:block lg:absolute lg:inset-0">
          <div className="absolute inset-0 bg-[#103F38]" />
          <div className="relative mx-auto max-w-7xl px-8 py-12 text-white">
            <Logo inverse />
            <div className="mt-12 max-w-lg">
              <Badge tone="green">Your finances, simplified</Badge>
              <div className="mt-6 text-5xl font-bold leading-tight">
                Make every euro work smarter.
              </div>
              <p className="mt-5 text-lg leading-8 text-emerald-100/80">
                One calm, organized space to understand spending, grow savings, and
                reach your financial goals.
              </p>
              <div className="mt-10 grid grid-cols-3 gap-3">
                {[
                  ['€4,250', 'Balance'],
                  ['44%', 'Saved'],
                  ['6', 'Budgets'],
                ].map(([v, l]) => (
                  <div
                    key={l}
                    className="rounded-2xl border border-white/10 bg-white/10 p-4"
                  >
                    <div className="text-2xl font-bold">{v}</div>
                    <div className="mt-1 text-xs text-emerald-100/70">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute bottom-12 text-sm text-emerald-100/60">
              Secure, private, and built around you.
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-7 shadow-sm lg:p-10">
          <div className="text-center lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:text-center lg:mb-8">
            <Logo />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-2 text-slate-500">
            Sign in to continue to your financial dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error || authError}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="accent-emerald-700" defaultChecked />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="font-semibold text-[#155C4F]"
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3 text-xs text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
            BACKEND ACCOUNTS
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Sign in with an account registered with BudgetFlow. Admin accounts must be provisioned separately.
          </div>

          <p className="mt-7 text-center text-sm text-slate-500">
            New to BudgetFlow?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-bold text-[#155C4F]"
            >
              Create account
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}

export default Login
