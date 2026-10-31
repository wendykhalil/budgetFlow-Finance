export const SUPPORTED_CURRENCIES = [
  { code: "TND", name: "Tunisian Dinar" },

  { code: "EUR", name: "Euro" },

  { code: "USD", name: "US Dollar" },

  { code: "GBP", name: "British Pound" },

  { code: "CAD", name: "Canadian Dollar" },

  { code: "CHF", name: "Swiss Franc" },

  { code: "SAR", name: "Saudi Riyal" },
]

const supportedCurrencyCodes = new Set(
  SUPPORTED_CURRENCIES.map(({ code }) => code),
)

export function normalizeCurrency(currency) {
  return supportedCurrencyCodes.has(currency) ? currency : "EUR"
}

export function getCurrencyFractionDigits(currency = "EUR") {
  return new Intl.NumberFormat("en", {
    style: "currency",

    currency: normalizeCurrency(currency),
  }).resolvedOptions().maximumFractionDigits
}

export function getCurrencySymbol(currency = "EUR") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",

    currency: normalizeCurrency(currency),

    currencyDisplay: "narrowSymbol",
  })

    .formatToParts(0)

    .find((part) => part.type === "currency")?.value
}
