import { useState } from "react"

import { Link, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/contexts/AuthContext"

import Logo from "@/components/layout/Logo"

import Button from "@/components/ui/Button"

import Badge from "@/components/ui/Badge"

import Input from "@/components/ui/Input"

const getFriendlyLoginError = (error) => {
  if (error?.status === 401) {
    return "The email or password you entered is incorrect."
  }

  return "We couldn't sign you in. Please try again in a moment."
}

export function Login() {
  const navigate = useNavigate()

  const location = useLocation()

  const { login, authError } = useAuth()

  const [email, setEmail] = useState("")

  const [password, setPassword] = useState("")

  const [error, setError] = useState("")

  const [loading, setLoading] = useState(false)

  const visibleError = error || (authError ? "Please sign in to continue." : "")

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (loading) return

    setLoading(true)

    setError("")

    try {
      const result = await login(email, password)

      const isAdmin = result.user.role === "admin"

      const rolePrefix = isAdmin ? "/admin/" : "/client/"

      const roleHome = isAdmin ? "/admin/dashboard" : "/client/dashboard"

      const requestedPath = location.state?.from

      const path = requestedPath?.startsWith(rolePrefix)
        ? requestedPath
        : roleHome

      navigate(path, { replace: true })
    } catch (loginError) {
      if (import.meta.env.DEV) {
        console.error("Login request failed:", loginError)
      }

      setError(getFriendlyLoginError(loginError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7F6] lg:bg-[#103F38]">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 p-4 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:px-12 lg:py-10">
        <section
          aria-label="About BudgetFlow"
          className="hidden text-white lg:block"
        >
          <Logo inverse />
          <div className="mt-16 max-w-xl">
            <Badge tone="green">Your finances, simplified</Badge>
            <h2 className="mt-7 text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
              Make every financial decision feel clearer.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-emerald-100/80">
              One calm, organized space to understand spending, grow savings,
              and work toward your goals.
            </p>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-emerald-50">
                A clearer view of your money
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  "Spending overview",
                  "Flexible budgets",
                  "Track your progress",
                ].map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-emerald-50/90"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-12 text-sm text-emerald-100/60">
            Secure, private, and built around you.
          </p>
        </section>

        <section className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-slate-900/5 sm:p-9">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-2 text-slate-500">
            Sign in to continue to your financial dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 accent-[#155C4F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  defaultChecked
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="font-semibold text-[#155C4F] underline-offset-4 hover:text-[#104B41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Forgot password?
              </Link>
            </div>
            {visibleError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {visibleError}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {loading && (
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            New to BudgetFlow?{" "}
            <Link
              to="/register"
              className="font-bold text-[#155C4F] underline-offset-4 hover:text-[#104B41] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Create account
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}

export default Login
