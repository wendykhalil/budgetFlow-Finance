import { describe, expect, it } from "vitest"

import {
  formatCalendarDate,
  getLocalDateString,
  isValidCalendarDate,
} from "@/utils/calendarDates"

import { filterTransactions } from "@/utils/formatters"

import {
  getTransactionDraftKey,
  readTransactionDraft,
  saveTransactionDraft,
} from "@/utils/transactionDrafts"

describe("calendar date utilities", () => {
  it("uses local calendar components when deriving the current date", () => {
    const instant = new Date("2026-03-01T00:30:00.000Z")

    const expected = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, "0")}-${String(instant.getDate()).padStart(2, "0")}`

    expect(getLocalDateString(instant)).toBe(expected)
  })

  it("validates month lengths, leap years, and strict YYYY-MM-DD values", () => {
    expect(isValidCalendarDate("2024-02-29")).toBe(true)

    expect(isValidCalendarDate("2000-02-29")).toBe(true)

    expect(isValidCalendarDate("1900-02-29")).toBe(false)

    expect(isValidCalendarDate("2026-02-29")).toBe(false)

    expect(isValidCalendarDate("2026-04-31")).toBe(false)

    expect(isValidCalendarDate("2026-13-01")).toBe(false)

    expect(isValidCalendarDate("2026-1-01")).toBe(false)
  })

  it("formats date strings without parsing them as UTC instants", () => {
    expect(
      formatCalendarDate("2026-01-01", "en-GB", {
        year: "numeric",

        month: "short",

        day: "numeric",
      }),
    ).toBe("1 Jan 2026")
  })

  it("discards drafts containing invalid calendar dates", () => {
    const userId = "date-validation-user"

    const key = getTransactionDraftKey(userId)

    saveTransactionDraft(
      userId,

      null,

      {
        description: "",

        amount: "",

        type: "expense",

        categoryId: "",

        legacyCategory: "",

        date: "2026-02-29",

        paymentMethod: "",

        status: "completed",

        note: "",
      },

      null,
    )

    expect(readTransactionDraft(userId, null)).toMatchObject({
      draft: null,

      error: false,

      outdated: true,
    })

    expect(localStorage.getItem(key)).toBeNull()
  })

  it("filters inclusive calendar dates at month and year boundaries", () => {
    const transactions = [
      { date: "2026-02-28", description: "February end", category: "Food" },

      { date: "2026-03-01", description: "March start", category: "Food" },

      { date: "2026-03-31", description: "March end", category: "Food" },

      { date: "2026-04-01", description: "April start", category: "Food" },

      { date: "2025-12-31", description: "Prior year", category: "Food" },
    ]

    const now = new Date(2026, 2, 1, 0, 30)

    expect(
      filterTransactions(transactions, { date: "this-month", now }).map(
        (transaction) => transaction.date,
      ),
    ).toEqual(["2026-03-01", "2026-03-31"])

    expect(
      filterTransactions(transactions, { date: "last-month", now }).map(
        (transaction) => transaction.date,
      ),
    ).toEqual(["2026-02-28"])

    expect(
      filterTransactions(transactions, { date: "this-year", now }).map(
        (transaction) => transaction.date,
      ),
    ).toEqual(["2026-02-28", "2026-03-01", "2026-03-31", "2026-04-01"])
  })
})
