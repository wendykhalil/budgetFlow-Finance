import { useState } from 'react'
import PageTitle from '@/components/layout/PageTitle'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Icon from '@/components/ui/Icon'
import { transactions, formatAmount, formatCurrency } from '@/data/mockTransactions'

export function ClientCalendar() {
  const [selectedDate, setSelectedDate] = useState(24)
  const daysInMonth = 31
  const startDay = 3

  const days = []
  for (let i = 0; i < startDay; i++) days.push({ day: null, date: `empty-${i}` })
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, date: `2026-10-${String(i).padStart(2, '0')}` })

  const dayTransactions = transactions.filter((t) => {
    const day = parseInt(t.date.split('-')[2])
    return day === selectedDate
  })

  const upcomingTransactions = transactions.filter((t) => {
    const day = parseInt(t.date.split('-')[2])
    return day >= 24
  })

  return (
    <>
      <PageTitle
        title="Financial calendar"
        sub="See when money moves in and out of your accounts."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">
              Previous
            </Button>
            <Button variant="secondary" size="sm">
              Next
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-6 text-xl font-bold">October 2026</div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
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
                onClick={() => d.day && setSelectedDate(d.day)}
                className={`min-h-20 p-2 text-xs md:min-h-28 ${d.day ? 'cursor-pointer bg-white' : 'bg-slate-50'}`}
              >
                {d.day && (
                  <span
                    className={`mb-1 grid size-6 place-items-center rounded-full ${
                      d.day === selectedDate
                        ? 'bg-[#155C4F] text-white'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {d.day}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-lg font-bold">October {selectedDate}, 2026</div>
          {dayTransactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No transactions on this day.
            </div>
          ) : (
            <div className="space-y-3">
              {dayTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <div className="font-semibold">{t.description}</div>
                    <div className="text-xs text-slate-400">{t.category}</div>
                  </div>
                  <div className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {formatAmount(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm font-semibold text-slate-700 mb-3">Upcoming</div>
            <div className="space-y-3">
              {upcomingTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <div className="font-semibold">{t.description}</div>
                    <div className="text-xs text-slate-400">
                      Oct {parseInt(t.date.split('-')[2])}
                    </div>
                  </div>
                  <div className={`font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {formatAmount(t.amount)}
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
