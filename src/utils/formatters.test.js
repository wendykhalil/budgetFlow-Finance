import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatSignedCurrency,
  formatUserCurrency,
} from "@/utils/formatters"

import {
  getCurrencyFractionDigits,
  SUPPORTED_CURRENCIES,
} from "@/utils/currencies"

describe("currency formatting", () => {
  it("formats account currency with the currency-specific precision", () => {
    expect(getCurrencyFractionDigits("TND")).toBe(3)

    expect(getCurrencyFractionDigits("EUR")).toBe(2)

    expect(getCurrencyFractionDigits("USD")).toBe(2)

    expect(getCurrencyFractionDigits("GBP")).toBe(2)

    expect(getCurrencyFractionDigits("CAD")).toBe(2)

    expect(getCurrencyFractionDigits("CHF")).toBe(2)

    expect(getCurrencyFractionDigits("SAR")).toBe(2)
  })

  it("formats supported currencies through Intl without changing the amount", () => {
    for (const { code } of SUPPORTED_CURRENCIES) {
      expect(formatUserCurrency(12.345, code)).toBe(
        new Intl.NumberFormat("en-GB", {
          style: "currency",

          currency: code,
        }).format(12.345),
      )
    }

    expect(formatUserCurrency(12.345, "TND")).toContain("12.345")

    expect(formatUserCurrency(12.345, "EUR")).toContain("12.35")
  })

  it("supports signed transaction amounts using the selected currency", () => {
    expect(formatCurrency(-10, "USD")).toBe(formatSignedCurrency(-10, "USD"))

    expect(formatSignedCurrency(-1.234, "TND")).toContain("1.234")

    expect(formatSignedCurrency(0, "EUR")).not.toContain("+")
  })
})
