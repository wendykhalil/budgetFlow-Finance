const SUPPORTED_CURRENCIES = Object.freeze([
  'TND',
  'EUR',
  'USD',
  'GBP',
  'CAD',
  'CHF',
  'SAR',
]);

function isSupportedCurrency(currency) {
  return SUPPORTED_CURRENCIES.includes(currency);
}

function normalizeCurrency(currency) {
  return isSupportedCurrency(currency) ? currency : 'EUR';
}

module.exports = {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
  normalizeCurrency,
};
