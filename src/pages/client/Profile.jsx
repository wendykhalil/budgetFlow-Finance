import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import Input from '@/components/ui/Input'
import Icon from '@/components/ui/Icon'
import { getUserDisplayName, getUserInitials } from '@/utils/userIdentity'

export function ClientProfile() {
  const { user, login } = useAuth()
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState('+33 6 12 34 56 78')
  const [currency, setCurrency] = useState('EUR')
  const [country, setCountry] = useState('France')
  const [showToast, setShowToast] = useState(false)

  const handleSave = () => {
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)
  }

  return (
    <>
      <PageTitle
        title="Your profile"
        sub="Manage your personal information and preferences."
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="text-center">
          <Avatar initials={getUserInitials(user)} size="xl" color={user?.avatarColor || 'emerald'} />
          <div className="mt-4 text-xl font-bold">{getUserDisplayName(user)}</div>
          <div className="text-sm text-slate-500">{email}</div>
          <Badge tone="green" className="mt-2">
            Active client
          </Badge>
        </Card>

        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled
            />
            <Input
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled
            />
            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary">Change password</Button>
            <Button onClick={handleSave}>Save profile</Button>
          </div>
        </Card>
      </div>

      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" className="size-4" />
          </span>
          Profile updated successfully.
        </div>
      )}
    </>
  )
}

export default ClientProfile
