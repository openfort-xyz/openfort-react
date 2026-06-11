/**
 * Provides the display Ethereum address for the playground.
 * - evm: address from wagmi (external) or embedded
 * - svm: no Ethereum address (Solana only)
 */

import { useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import type React from 'react'
import { createContext, useContext } from 'react'
import { useAccount } from 'wagmi'

const EthereumAddressContext = createContext<`0x${string}` | undefined>(undefined)

function getEmbeddedAddress(
  embedded: ReturnType<typeof useEthereumEmbeddedWallet>,
  core: ReturnType<typeof useOpenfort>
): `0x${string}` | undefined {
  return embedded.status === 'connected' ? embedded.address : (core.activeEmbeddedAddress as `0x${string}` | undefined)
}

/** Use inside WagmiProvider (evm mode). */
export function EthereumAddressProviderWagmi({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress } = useAccount()
  const embedded = useEthereumEmbeddedWallet()
  const core = useOpenfort()
  const address = wagmiAddress ?? getEmbeddedAddress(embedded, core)
  const value = address ?? undefined
  return <EthereumAddressContext.Provider value={value}>{children}</EthereumAddressContext.Provider>
}

/** Use when WagmiProvider is not mounted (SVM or non-wagmi EVM). */
export function EthereumAddressProviderEmbedded({ children }: { children: React.ReactNode }) {
  const embedded = useEthereumEmbeddedWallet()
  const core = useOpenfort()
  const address = getEmbeddedAddress(embedded, core)
  const value = address ?? undefined
  return <EthereumAddressContext.Provider value={value}>{children}</EthereumAddressContext.Provider>
}

export function useEthereumAddressContext(): `0x${string}` | undefined {
  return useContext(EthereumAddressContext)
}
