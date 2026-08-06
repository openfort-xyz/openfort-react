import { toError } from '../errors/base.js'
import { FundingError } from '../errors/funding.js'

export type FundingProvider = 'coinbase' | 'stripe'

const FUNDING_PROVIDER_HOSTS: Record<FundingProvider, ReadonlySet<string>> = {
  coinbase: new Set(['pay.coinbase.com']),
  stripe: new Set(['crypto.link.com']),
}

/** Parses a provider URL only when it targets the provider's HTTPS origin. */
export function getTrustedFundingProviderUrl(value: string, provider: FundingProvider): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch (cause) {
    throw new FundingError(`The ${provider} funding URL is invalid.`, { cause: toError(cause) })
  }

  const trusted =
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    FUNDING_PROVIDER_HOSTS[provider].has(url.hostname.toLowerCase())
  if (!trusted) {
    throw new FundingError(`The ${provider} funding URL has an untrusted origin.`)
  }

  return url
}
