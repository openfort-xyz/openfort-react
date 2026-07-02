import type { Hex } from 'viem'
import { DEST_USDC_SOL } from '../../../hooks/openfort/fundingSources'
import type { Asset } from '../../Openfort/types'

/**
 * Buyable Solana destination currencies for the fiat onramp. USDC is first so it
 * is the default; both are supported by Coinbase and Stripe on Solana. Balances
 * aren't needed (you're buying), so these carry zero balance — only the symbol
 * feeds the onramp `destinationCurrency`. The USDC `address` is the SPL mint cast
 * to `Hex` to fit the shared `Asset` type; it's only read by `getAssetSymbol`.
 */
export const SOLANA_BUY_CURRENCIES: Asset[] = [
  {
    type: 'erc20',
    address: DEST_USDC_SOL as Hex,
    balance: BigInt(0),
    metadata: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  },
  {
    type: 'native',
    balance: BigInt(0),
    metadata: { symbol: 'SOL', decimals: 9, fiat: { value: 0, currency: 'USD' } },
  },
]
