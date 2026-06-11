/**
 * Shared logic for creating viem wallet client from embedded Ethereum provider.
 * Used by useGrantPermissions and useRevokePermissions.
 */

import type { Chain, Hex } from 'viem'
import { createWalletClient, custom } from 'viem'
import { erc7715Actions } from 'viem/experimental'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../types'

/**
 * Create viem wallet client from embedded provider.
 * When extendErc7715 is true, returns client with grantPermissions etc.
 */
export async function getEmbeddedWalletClient(
  provider: OpenfortEmbeddedEthereumWalletProvider,
  chain: Chain,
  options?: { extendErc7715?: boolean }
): Promise<ReturnType<ReturnType<typeof createWalletClient>['extend']> | ReturnType<typeof createWalletClient>> {
  const accounts = (await provider.request({ method: 'eth_accounts' })) as Hex[]
  if (!accounts?.length) throw new OpenfortError('No accounts available', OpenfortReactErrorType.WALLET_ERROR)
  const account = accounts[0]
  const transport = custom(provider)
  const baseClient = createWalletClient({ account, chain, transport })
  return options?.extendErc7715 ? baseClient.extend(erc7715Actions()) : baseClient
}
