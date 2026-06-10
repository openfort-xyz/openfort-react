/**
 * Curated source assets for the demo deposit flow — USDC/USDT across a few EVM
 * chains plus Solana, with logos and the fixed destination. A production build
 * would source these from a server-provided token registry.
 */

export const SOLANA_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'

export type SourceChain = { id: string; name: string; logo: string }

export const SOURCE_CHAINS: SourceChain[] = [
  { id: 'eip155:137', name: 'Polygon', logo: 'https://icons.llamao.fi/icons/chains/rsz_polygon.jpg' },
  { id: 'eip155:42161', name: 'Arbitrum', logo: 'https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg' },
  { id: 'eip155:8453', name: 'Base', logo: 'https://icons.llamao.fi/icons/chains/rsz_base.jpg' },
  { id: 'eip155:10', name: 'Optimism', logo: 'https://icons.llamao.fi/icons/chains/rsz_optimism.jpg' },
  { id: SOLANA_CHAIN, name: 'Solana', logo: 'https://icons.llamao.fi/icons/chains/rsz_solana.jpg' },
]

const USDC_LOGO = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png'
const USDT_LOGO = 'https://assets.coingecko.com/coins/images/325/small/Tether.png'

export type TokenInfo = { symbol: string; address: string; logo: string }

const usdc = (address: string): TokenInfo => ({ symbol: 'USDC', address, logo: USDC_LOGO })
const usdt = (address: string): TokenInfo => ({ symbol: 'USDT', address, logo: USDT_LOGO })

/** Mainnet USDC/USDT contracts per supported source chain. */
export const TOKENS_BY_CHAIN: Record<string, TokenInfo[]> = {
  'eip155:137': [
    usdc('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'),
    usdt('0xc2132D05D31c914a87C6611C10748AEb04B58e8F'),
  ],
  'eip155:42161': [
    usdc('0xaf88d065e77c8cC2239327C5EDb3A432268e5831'),
    usdt('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'),
  ],
  'eip155:8453': [
    usdc('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
    usdt('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'),
  ],
  'eip155:10': [usdc('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'), usdt('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58')],
  [SOLANA_CHAIN]: [
    usdc('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    usdt('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'),
  ],
}

/** Exchanges offered in the "transfer from an exchange" flow. */
export const EXCHANGES = ['binance', 'coinbase'] as const

/** Destination for the demo: USDC on Base. */
export const DEST_CHAIN = 'eip155:8453'
export const DEST_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

/**
 * Nominal amount used only to fetch an *open* (reusable) deposit address — the
 * address is route-bound, so it stays valid for any amount above the minimum.
 */
export const NOMINAL_UNITS = '10000000'

export function tokensFor(chain: string): TokenInfo[] {
  return TOKENS_BY_CHAIN[chain] ?? []
}

export function tokenInfo(chain: string, symbol: string): TokenInfo | undefined {
  return tokensFor(chain).find((t) => t.symbol === symbol)
}

export function addressFor(chain: string, symbol: string): string {
  return tokenInfo(chain, symbol)?.address ?? DEST_USDC
}

export function chainLogo(id: string): string {
  return SOURCE_CHAINS.find((c) => c.id === id)?.logo ?? ''
}

export function tokenLogo(chain: string, symbol: string): string {
  return tokenInfo(chain, symbol)?.logo ?? USDC_LOGO
}

export function chainName(id: string): string {
  return SOURCE_CHAINS.find((c) => c.id === id)?.name ?? id
}

export function isSolana(chain: string): boolean {
  return chain.startsWith('solana:')
}

/** Format a 6-decimal (USDC/USDT) base-unit amount as a human string. */
export function formatUnits6(units: string): string {
  const n = Number(units) / 1_000_000
  if (!Number.isFinite(n)) return units
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}
