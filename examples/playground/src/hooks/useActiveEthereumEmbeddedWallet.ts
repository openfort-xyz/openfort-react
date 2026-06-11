/**
 * Single hook for EVM embedded wallet state in the playground.
 *
 * Returns the hook instance alongside derived `activeWallet` and
 * `connectingAddress`. Consumers should use the returned `ethereum` instead of
 * calling `useEthereumEmbeddedWallet()` separately — otherwise two independent
 * state instances exist and the connecting status won't propagate.
 */

import { type EthereumWalletState, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'

type EmbeddedWallet = EthereumWalletState['wallets'][number]

export function useActiveEthereumEmbeddedWallet(): {
  ethereum: EthereumWalletState
  activeWallet: EmbeddedWallet | null
  connectingAddress: string | undefined
} {
  const core = useOpenfort()
  const embedded = useEthereumEmbeddedWallet()

  const hasActiveWallet =
    embedded.status === 'connected' ||
    embedded.status === 'connecting' ||
    embedded.status === 'reconnecting' ||
    embedded.status === 'needs-recovery'

  const activeWallet: EmbeddedWallet | null = hasActiveWallet
    ? (embedded.activeWallet ?? null)
    : (embedded.wallets.find((w) => w.address.toLowerCase() === core.activeEmbeddedAddress?.toLowerCase()) ?? null)

  const connectingAddress =
    embedded.status === 'connecting' || embedded.status === 'reconnecting' ? embedded.activeWallet?.address : undefined

  return { ethereum: embedded, activeWallet, connectingAddress }
}
