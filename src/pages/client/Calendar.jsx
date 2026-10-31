import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import PageTitle from "@/components/layout/PageTitle"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import { transactions } from "@/data/mockTransactions"
import { formatSignedCurrency } from "@/utils/formatters"
import { formatCalendarDate } from "@/utils/calendarDates"

export function ClientCalendar() {
  const { user } = useAuth()
  const currency = user?.currency || "EUR"
  const [displayMonth, setDisplayMonth] = useState(() => new Date(2026, 9, 1))
  const [selectedDate, setSelectedDate] = useState("2026-10-24")
  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = (new Date(year, month, 1).getDay() + 6) % 7

  const days = []
  for (let i = 0; i < startDay; i++)
    days.push({ day: null, date: `empty-${i}` })
  for (let i = 1; i <= daysInMonth; i++)
    days.push({ day: i, date: `${monthKey}-${String(i).padStart(2, "0")}` })

  const userTransactions = transactions.filter(
    (transaction) => transaction.userId === user?.id,
  )
  const dayTransactions = userTransactions.filter(
    (transaction) => transaction.date === selectedDate,
  )
  const upcomingTransactions = userTransactions.filter(
    (transaction) =>
      transaction.status === "pending" &&
      transaction.date > selectedDate &&
      transaction.date.startsWith(monthKey),
  )

  const changeMonth = (amount) => {
    const nextMonth = new Date(year, month + amount, 1)
    setDisplayMonth(nextMonth)
    setSelectedDate(
      `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`,
    )
  }

  return (
    <>
      <PageTitle
        title="Financial calendar"
        sub="See when money moves in and out of your accounts."
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => changeMonth(-1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => changeMonth(1)}
            >
              Next
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-6 text-xl font-bold">
            {displayMonth.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="bg-slate-50 p-2 text-center text-[10px] font-bold uppercase text-slate-400"
              >
                {d}
              </div>
            ))}
            {days.map((d) => (
              <div
                key={d.date}
                className={`min-h-20 p-2 text-xs md:min-h-28 ${
                  d.day ? "bg-white" : "bg-slate-50"
                }`}
              >
                {d.day && (
                  <button
                    type="button"
                    aria-label={formatCalendarDate(d.date, "en-GB", {
                      dateStyle: "full",
                    })}
                    aria-pressed={d.date === selectedDate}
                    onClick={() => setSelectedDate(d.date)}
                    className={`mb-1 grid size-6 place-items-center rounded-full ${
                      d.date === selectedDate
                        ? "bg-[#155C4F] text-white"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    {d.day}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-lg font-bold">
            {formatCalendarDate(selectedDate, "en-GB", { dateStyle: "long" })}
          </div>
          {dayTransactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No transactions on this day.
            </div>
          ) : (
            <div className="space-y-3">
              {dayTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div>
                    <div className="font-semibold">{t.description}</div>
                    <div className="text-xs text-slate-400">{t.category}</div>
                  </div>
                  <div
                    className={`font-bold ${
                      t.type === "income"
                        ? "text-emerald-600"
                        : "text-slate-800"
                    }`}
                  >
                    {formatSignedCurrency(
                      t.type === "expense" ? -t.amount : t.amount,
                      currency,
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Upcoming
            </div>
            <div className="space-y-3">
              {upcomingTransactions.length === 0 && (
                <p className="text-sm text-slate-500">
                  No upcoming transactions.
                </p>
              )}
              {upcomingTransactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                >
                  <div>
                    <div className="font-semibold">{t.description}</div>
                    <div className="text-xs text-slate-400">
                      {formatCalendarDate(t.date, "en-GB", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <div
                    className={`font-bold ${
                      t.type === "income"
                        ? "text-emerald-600"
                        : "text-slate-800"
                    }`}
                  >
                    {formatSignedCurrency(
                      t.type === "expense" ? -t.amount : t.amount,
                      currency,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

export default ClientCalendar
