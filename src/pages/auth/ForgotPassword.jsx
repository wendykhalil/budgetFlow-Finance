import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setSubmitted(true)
      setLoading(false)
    }, 800)
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Forgot password?
      </h1>
      <p className="mt-2 text-slate-500">
        Enter your email and we'll send you a reset link.
      </p>

      {submitted ? (
        <div className="mt-8 rounded-xl bg-emerald-50 p-6 text-center">
          <div className="mb-4 text-3xl">✓</div>
          <h3 className="font-bold text-emerald-800">Reset email sent!</h3>
          <p className="mt-2 text-sm text-emerald-700">
            Check your inbox for a password reset link.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 font-semibold text-[#155C4F]"
          >
            Back to login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="alex.martin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={loading || !email} className="w-full">
            {loading ? 'Sending...' : 'Send reset link'}
          </Button>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full text-center text-sm font-semibold text-[#155C4F]"
          >
            Back to login
          </button>
        </form>
      )}
    </div>
  )
}

export default ForgotPassword
