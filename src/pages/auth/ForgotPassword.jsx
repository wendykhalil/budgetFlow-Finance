import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Forgot password?
      </h1>
      <p className="mt-2 text-slate-500">
        Password reset email delivery is unavailable in this demo.
      </p>

      {submitted ? (
        <div role="status" className="mt-8 rounded-xl bg-emerald-50 p-6 text-center">
          <div className="mb-4 text-3xl">!</div>
          <h3 className="font-bold text-amber-800">No email was sent</h3>
          <p className="mt-2 text-sm text-amber-700">
            Password reset requires a backend email service, which is not configured.
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
          <Button type="submit" disabled={!email} className="w-full">
            Check reset availability
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
