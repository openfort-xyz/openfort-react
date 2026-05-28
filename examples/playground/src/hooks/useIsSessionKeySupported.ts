import { AccountTypeEnum } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'

/**
 * Session keys today only work for Smart Accounts.
 * EOAs cannot use session keys at all; Delegated Account support is on the roadmap but not yet enabled.
 * External wallets (MetaMask, etc.) are detected separately via useAccount().connector in the card.
 */
export function useIsSessionKeySupported(): boolean {
  const ethereum = useEthereumEmbeddedWallet()

  if (ethereum.status !== 'connected' || !ethereum.activeWallet) return false

  return ethereum.activeWallet.accountType === AccountTypeEnum.SMART_ACCOUNT
}
