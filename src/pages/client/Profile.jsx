import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"
import Card from "@/components/ui/Card"
import Avatar from "@/components/ui/Avatar"
import Input from "@/components/ui/Input"
import Icon from "@/components/ui/Icon"
import { getUserDisplayName, getUserInitials } from "@/utils/userIdentity"
import { useTransactions } from "@/contexts/TransactionContext"
import { SUPPORTED_CURRENCIES } from "@/utils/currencies"

export function ClientProfile() {
  const { user, updateProfile, updateCurrency } = useAuth()
  const {
    transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useTransactions()
  const [firstName, setFirstName] = useState(user?.firstName || "")
  const [lastName, setLastName] = useState(user?.lastName || "")
  const [email, setEmail] = useState(user?.email || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [country, setCountry] = useState(user?.country || "")
  const [showToast, setShowToast] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [currencyError, setCurrencyError] = useState("")
  const [currencySaving, setCurrencySaving] = useState(false)
  const [currencySaved, setCurrencySaved] = useState(false)
  const currencyLocked =
    transactionsLoading || Boolean(transactionsError) || transactions.length > 0

  const handleCurrencyChange = async (event) => {
    const currency = event.target.value
    if (currency === (user?.currency || "EUR") || currencySaving) return

    setCurrencySaving(true)
    setCurrencyError("")
    setCurrencySaved(false)
    try {
      await updateCurrency(currency)
      setCurrencySaved(true)
    } catch (error) {
      setCurrencyError(
        error.message || "Could not update your account currency.",
      )
    } finally {
      setCurrencySaving(false)
    }
  }

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      setSaveError("First name and last name are required.")
      return
    }
    setSaveError("")
    updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      country,
    })
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
          <Avatar
            initials={getUserInitials(user)}
            size="xl"
            color={user?.avatarColor || "emerald"}
          />
          <div className="mt-4 text-xl font-bold">
            {getUserDisplayName(user)}
          </div>
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
            <div>
              <label
                htmlFor="profile-currency"
                className="text-sm font-semibold text-slate-700"
              >
                Account currency
              </label>
              <select
                id="profile-currency"
                value={user?.currency || "EUR"}
                onChange={handleCurrencyChange}
                disabled={currencyLocked || currencySaving}
                aria-describedby="currency-help"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                {SUPPORTED_CURRENCIES.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
              <p id="currency-help" className="mt-2 text-xs text-slate-500">
                {transactionsLoading
                  ? "Checking transaction history..."
                  : transactionsError
                    ? "Currency changes are unavailable until transaction history can be verified."
                    : transactions.length > 0
                      ? "Locked because this account has transactions. Changing currency requires a future explicit conversion feature."
                      : "You can change this while your account has no transactions."}
              </p>
              {currencySaving && (
                <p role="status" className="mt-2 text-xs text-slate-500">
                  Saving currency...
                </p>
              )}
              {currencySaved && (
                <p role="status" className="mt-2 text-xs text-emerald-700">
                  Account currency updated.
                </p>
              )}
              {currencyError && (
                <p role="alert" className="mt-2 text-xs text-rose-600">
                  {currencyError}
                </p>
              )}
            </div>
            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {saveError && (
            <p role="alert" className="mt-4 text-sm text-rose-600">
              {saveError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled
              title="Password changes require a backend service"
            >
              Password change unavailable
            </Button>
            <Button onClick={handleSave}>Save profile</Button>
          </div>
        </Card>
      </div>

      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <span className="grid size-6 place-items-center rounded-full bg-emerald-500">
            <Icon name="check" className="size-4" />
          </span>
          Profile updated for this session. Changes reset after refresh.
        </div>
      )}
    </>
  )
}

export default ClientProfile
