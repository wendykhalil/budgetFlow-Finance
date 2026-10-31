export function getLocalDateString(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, "0")

  const month = String(date.getMonth() + 1).padStart(2, "0")

  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function isValidCalendarDate(value) {
  if (typeof value !== "string") return false

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return false

  const year = Number(match[1])

  const month = Number(match[2])

  const day = Number(match[3])

  if (month < 1 || month > 12) return false

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)

  const daysInMonth = [
    31,

    isLeapYear ? 29 : 28,

    31,

    30,

    31,

    30,

    31,

    31,

    30,

    31,

    30,

    31,
  ]

  return day >= 1 && day <= daysInMonth[month - 1]
}

export function formatCalendarDate(
  value,

  locale = "en-GB",

  options = { year: "numeric", month: "short", day: "numeric" },
) {
  if (!isValidCalendarDate(value)) return value || ""

  const [year, month, day] = value.split("-").map(Number)

  const date = new Date(0)

  date.setFullYear(year, month - 1, day)

  date.setHours(12, 0, 0, 0)

  return date.toLocaleDateString(locale, options)
}
