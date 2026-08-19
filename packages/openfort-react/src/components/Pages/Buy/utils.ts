export const createCurrencyFormatter = (currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
}

/**
 * CSS width for a BigAmountInput that hugs its value, so the currency symbol
 * stays attached ($|50|). Clamped to 12ch so an absurd entry can't blow the row.
 */
export const amountInputWidth = (value: string): string => `${Math.min(Math.max(value.length, 1), 12)}ch`

export const getCurrencySymbol = (currency: string) => {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).formatToParts(0)
    return parts.find((part) => part.type === 'currency')?.value ?? '$'
  } catch {
    return '$'
  }
}

/**
 * Formats a number with dynamic decimal places between 2 and 6
 * Removes trailing zeros but ensures at least 2 decimals
 */
export const formatWithDynamicDecimals = (amount: number): string => {
  const MIN_DECIMALS = 2
  const MAX_DECIMALS = 6

  // Format with max decimals, remove trailing zeros, then ensure min decimals
  const formatted = amount.toFixed(MAX_DECIMALS)
  const withoutTrailingZeros = Number.parseFloat(formatted).toString()

  // If it has a decimal point, check if we need to pad to MIN_DECIMALS
  if (withoutTrailingZeros.includes('.')) {
    const [integer, decimal] = withoutTrailingZeros.split('.')
    if (decimal.length < MIN_DECIMALS) {
      return `${integer}.${decimal.padEnd(MIN_DECIMALS, '0')}`
    }
    return withoutTrailingZeros
  }

  // No decimal point, add MIN_DECIMALS
  return amount.toFixed(MIN_DECIMALS)
}

// EU/EEA, where the onramp prices in euro. Everywhere else falls to USD: the
// providers settle only usd and eur (gbp is a valid parameter but currently
// routes no pairs), and non-EU buyers — the UK included — reach the hosted
// checkout, which picks its own local currency regardless of what we send.
const EUR_COUNTRIES = new Set(
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK ES'.split(' ')
)

/** The fiat currency to price a buy in for a resolved buyer country. */
export const defaultCurrencyForCountry = (country: string | null | undefined): string =>
  country && EUR_COUNTRIES.has(country.toUpperCase()) ? 'EUR' : 'USD'
