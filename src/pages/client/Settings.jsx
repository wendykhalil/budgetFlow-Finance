import { useState } from "react"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Icon from "@/components/ui/Icon"

export function ClientSettings() {
  const [language, setLanguage] = useState("en")
  const [dateFormat, setDateFormat] = useState("MM/dd/yyyy")
  const [showToast, setShowToast] = useState(false)

  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem("budgetflow_client_settings")
    return savedSettings
      ? JSON.parse(savedSettings)
      : {
          Account: true,
          Preferences: true,
          Notifications: true,
          Appearance: true,
        }
  })

  const toggleSetting = (name) => {
    setSettings((previous) => ({ ...previous, [name]: !previous[name] }))
  }

  const handleSave = () => {
    localStorage.setItem("budgetflow_client_settings", JSON.stringify(settings))
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2500)
  }

  return (
    <>
      <PageTitle title="Settings" sub="Customize your BudgetFlow experience." />

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          ["Account", "Personal information and password", "user"],
          ["Preferences", "Currency, language, and date format", "settings"],
          ["Notifications", "Budget alerts and monthly reports", "bell"],
          ["Appearance", "Light and dark display mode", "activity"],
        ].map(([t, d, icon]) => (
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
                <input
                  type="checkbox"
                  aria-label={`Enable ${t} settings`}
                  className="peer sr-only"
                  checked={Boolean(settings[t])}
                  onChange={() => toggleSetting(t)}
                />
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
          Settings saved on this device.
        </div>
      )}
    </>
  )
}

export default ClientSettings
