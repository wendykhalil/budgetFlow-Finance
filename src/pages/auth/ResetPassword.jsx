import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('Password changes are unavailable in this demo; no password was changed.')
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Set new password
      </h1>
      <p className="mt-2 text-slate-500">
        Password reset requires an email service and backend, which are not configured.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Input
          label="New password"
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={!password || !confirmPassword} className="w-full">
          Check reset availability
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/login')} className="w-full">
          Back to sign in
        </Button>
      </form>
    </div>
  )
}

export default ResetPassword
