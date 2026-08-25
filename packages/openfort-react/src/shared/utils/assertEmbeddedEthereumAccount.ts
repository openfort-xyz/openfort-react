import { WalletNotConnectedError } from '../../errors/wallet.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'

/** Ensures a delayed signer operation still targets the account and chain that requested it. */
export async function assertEmbeddedEthereumAccount(
  provider: OpenfortEmbeddedEthereumWalletProvider,
  intendedAddress: `0x${string}`,
  intendedChainId?: number
): Promise<void> {
  const accounts = await provider.request({ method: 'eth_accounts' })
  const matches =
    Array.isArray(accounts) &&
    typeof accounts[0] === 'string' &&
    accounts[0].toLowerCase() === intendedAddress.toLowerCase()
  if (!matches) {
    throw new WalletNotConnectedError('The active wallet changed before the operation could run.')
  }

  if (intendedChainId === undefined) return

  const providerChainId = await provider.request({ method: 'eth_chainId' })
  const numericChainId =
    typeof providerChainId === 'string' || typeof providerChainId === 'number' || typeof providerChainId === 'bigint'
      ? Number(providerChainId)
      : Number.NaN
  if (!Number.isSafeInteger(numericChainId) || numericChainId !== intendedChainId) {
    throw new WalletNotConnectedError('The active chain changed before the operation could run.')
  }
}
