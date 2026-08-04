/**
 * Centralized EVM account resolution for the playground.
 *
 * - useDisplayEthereumAddress: address only. Safe in evm (e.g. header).
 *   Uses EthereumAddressContext (provided by EthereumAddressProviderWagmi/Embedded).
 * - useConnectedEthereumAccount: address + chainId. Use only when WagmiProvider is mounted (evm cards).
 *   Uses wagmi hooks (useChainId, useSwitchChain) – same source as modal.
 */

import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useAccount, useChainId } from 'wagmi'
import { useEthereumAddressContext } from '@/contexts/EthereumAddressContext'
import { DEFAULT_EVM_CHAIN } from '@/lib/chains'

function getEmbeddedAddress(embedded: ReturnType<typeof useEthereumEmbeddedWallet>): `0x${string}` | undefined {
  return embedded.status === 'connected' ? embedded.address : undefined
}

/** Address only. Safe in evm. Use for header / display. */
export function useDisplayEthereumAddress(): `0x${string}` | undefined {
  return useEthereumAddressContext()
}

/** Address + chainId. Uses wagmi – only use when WagmiProvider is mounted (evm cards). */
export function useConnectedEthereumAccount(): {
  address: `0x${string}` | undefined
  chainId: number
} {
  const { address: wagmiAddress } = useAccount()
  const embedded = useEthereumEmbeddedWallet()

  const address = wagmiAddress ?? getEmbeddedAddress(embedded)
  const chainId = useChainId() ?? DEFAULT_EVM_CHAIN.id

  return {
    address: address ?? undefined,
    chainId,
  }
}
