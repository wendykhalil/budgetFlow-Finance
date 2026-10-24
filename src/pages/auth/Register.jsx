import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import Logo from '@/components/layout/Logo'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    currency: 'EUR',
    country: 'France',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const result = register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      currency: formData.currency,
      country: formData.country,
    })

    if (result.success) {
      navigate('/login')
    } else {
      setError(result.error || 'Registration failed')
    }
    setLoading(false)
  }

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-2 text-slate-500">
        Start managing your finances today.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First name"
            placeholder="Alex"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            placeholder="Martin"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
          />
        </div>
        <Input
          label="Email address"
          type="email"
          placeholder="alex.martin@example.com"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
        />
        <Input
          label="Phone"
          type="tel"
          placeholder="+33 6 12 34 56 78"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Min 6 characters"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <button
          onClick={() => navigate('/login')}
          className="font-bold text-[#155C4F]"
        >
         Sign in
        </button>
      </p>
    </div>
  )
}

export default Register
