import type { Hex } from 'viem'
import { DEST_USDC } from '../../../hooks/openfort/fundingSources.js'
import type { Asset } from '../../Openfort/types.js'

/**
 * Native USDC per mainnet chain, mirroring the api's onramp route table
 * (`OnrampCoverage.ONRAMP_ROUTES`). The buy default MUST use the target chain's
 * own USDC contract: pairing the target chain with another chain's address
 * (the old hardcoded Base value) mints a session no provider can deliver.
 */
const USDC_BY_CHAIN: Record<string, Hex> = {
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'eip155:8453': DEST_USDC as Hex,
  'eip155:137': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  'eip155:42161': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  'eip155:10': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
}

/**
 * Buyable EVM destination currencies for the fiat onramp, for a given target
 * chain. USDC is first so it is the default; both are supported by Coinbase and
 * Stripe. Balances aren't needed (you're buying), so these carry zero balance.
 * Unknown chains fall back to Base USDC (the api hides undeliverable rows
 * anyway). Mirrors {@link SOLANA_BUY_CURRENCIES} so the card/Apple Pay picker
 * always has options, even for a freshly created wallet with no indexed token
 * balances.
 */
export function evmBuyCurrencies(targetChain: string): [Asset, ...Asset[]] {
  return [
    {
      type: 'erc20',
      address: USDC_BY_CHAIN[targetChain] ?? (DEST_USDC as Hex),
      balance: BigInt(0),
      metadata: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    },
    {
      type: 'native',
      balance: BigInt(0),
      metadata: { symbol: 'ETH', decimals: 18, fiat: { value: 0, currency: 'USD' } },
    },
  ]
}
