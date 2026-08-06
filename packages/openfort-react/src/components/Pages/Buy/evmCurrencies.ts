import type { Hex } from 'viem'
import type { Asset } from '../../Openfort/types.js'
import { DEST_USDC } from '../Deposit/sources.js'

/**
 * Buyable EVM destination currencies for the fiat onramp. USDC is first so it is
 * the default; both are supported by Coinbase and Stripe. Balances aren't needed
 * (you're buying), so these carry zero balance — only the symbol feeds the onramp
 * `destinationCurrency`. The USDC `address` is Base USDC cast to `Hex` to fit the
 * shared `Asset` type; it's only read by `getAssetSymbol`. Mirrors
 * {@link SOLANA_BUY_CURRENCIES} so the card/Apple Pay picker always has options,
 * even for a freshly created wallet with no indexed token balances.
 */
export const EVM_BUY_CURRENCIES: [Asset, ...Asset[]] = [
  {
    type: 'erc20',
    address: DEST_USDC as Hex,
    balance: BigInt(0),
    metadata: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  },
  {
    type: 'native',
    balance: BigInt(0),
    metadata: { symbol: 'ETH', decimals: 18, fiat: { value: 0, currency: 'USD' } },
  },
]
