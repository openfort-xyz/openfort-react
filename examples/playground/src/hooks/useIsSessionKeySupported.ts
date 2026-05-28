import { AccountTypeEnum } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'

/**
 * Session keys are only supported for Smart Accounts and Delegated Accounts.
 * EOA (Externally Owned Accounts) cannot use session keys.
 * When using evm (wagmi), external wallets (MetaMask, etc.) are detected via useAccount().connector in the card.
 */
export function useIsSessionKeySupported(): boolean {
  const ethereum = useEthereumEmbeddedWallet()

  if (ethereum.status !== 'connected' || !ethereum.activeWallet) return false

  const accountType = ethereum.activeWallet.accountType
  return accountType === AccountTypeEnum.SMART_ACCOUNT || accountType === AccountTypeEnum.DELEGATED_ACCOUNT
}
