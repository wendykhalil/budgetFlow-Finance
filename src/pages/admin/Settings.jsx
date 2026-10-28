import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'

export function AdminSettings() {
  const [showToast, setShowToast] = useState(false)

  const settings = [
    ['General', 'Application name, currency, and language', 'user'],
    ['User management', 'Registration, verification, and suspension', 'users'],
    ['Notifications', 'System and budget notifications', 'bell'],
    ['Security', 'Session timeout and password policy', 'settings'],
  ]

  const handleSave = () => {
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)
  }

  return (
    <>
      <PageTitle
        title="Administration settings"
        sub="Configure platform defaults, security, and access."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {settings.map(([t, d, icon]) => (
          <Card key={t}>
            <div className="flex items-start gap-4">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-[#155C4F]">
                <Icon name={icon} />
              </span>
              <div className="flex-1">
                <div className="font-bold">{t}</div>
                <div className="mt-1 text-sm text-slate-500">{d}</div>
              </div>
              <label className="relative mt-1 inline-flex cursor-pointer items-center">
                <input type="checkbox" aria-label={`Enable ${t} settings`} className="peer sr-only" defaultChecked />
                <span className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-[#155C4F] after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              </label>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave}>Save changes</Button>
      </div>

      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" className="size-4" />
          </span>
          Admin settings saved successfully.
        </div>
      )}
    </>
  )
}

export default AdminSettings
