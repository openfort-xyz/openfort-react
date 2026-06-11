'use client'

import { createContext, useContext } from 'react'

interface OpenfortEthereumBridgeChain {
  id: number
  name?: string
}

export interface OpenfortEthereumBridgeConnector {
  id: string
  name: string
  icon?: string
  type?: string
  /** Optional; provided by wagmi connectors. Used when deciding QR vs injector flow. */
  getProvider?: () => Promise<unknown>
}

export interface OpenfortEthereumBridgeAccount {
  address: `0x${string}` | undefined
  chain?: OpenfortEthereumBridgeChain
  isConnected: boolean
  isConnecting: boolean
  isReconnecting: boolean
  connector?: OpenfortEthereumBridgeConnector
  ensName?: string
  ensAvatar?: string
}

interface OpenfortEthereumBridgeStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => void
}

export interface OpenfortEthereumBridgeConfig {
  chains: { id: number }[]
  getClient: (opts: { chainId: number }) => { transport: { url: string } }
  storage?: OpenfortEthereumBridgeStorage
}

export interface OpenfortEthereumBridgeSwitchChain {
  chains: OpenfortEthereumBridgeChain[]
  switchChain: ((params: { chainId: number }) => void) | undefined
  switchChainAsync?: (params: { chainId: number }) => Promise<unknown>
  isPending: boolean
  error: Error | null
}

export interface OpenfortEthereumBridgeValue {
  account: OpenfortEthereumBridgeAccount
  chainId: number
  config: OpenfortEthereumBridgeConfig
  disconnect: () => Promise<void>
  connect: (params: { connector: OpenfortEthereumBridgeConnector }) => void
  connectAsync?: (params: { connector: OpenfortEthereumBridgeConnector }) => Promise<unknown>
  reset: () => void
  connectors: OpenfortEthereumBridgeConnector[]
  switchChain: OpenfortEthereumBridgeSwitchChain
  getEnsAddress?: (name: string) => Promise<`0x${string}` | undefined>
  getEnsName?: (params: { address: `0x${string}` }) => Promise<string | undefined>
  getEnsAvatar?: (name: string) => Promise<string | undefined>
  getConnectorAccounts?: (connector: OpenfortEthereumBridgeConnector) => Promise<`0x${string}`[]>
  signMessage?: (params: { message: string }) => Promise<`0x${string}`>
  getWalletClient?: () => Promise<import('viem').WalletClient | undefined>
}

/**
 * Context for the wagmi bridge. Provides account, chain, connectors, and switchChain.
 * When using OpenfortProvider with wagmi, this is populated by OpenfortWagmiBridge.
 */
export const OpenfortEthereumBridgeContext = createContext<OpenfortEthereumBridgeValue | null>(null)

/**
 * Returns the wagmi bridge value when using OpenfortProvider with wagmi. Null when EVM-only.
 *
 * @returns Bridge value with account, chainId, connectors, switchChain, etc. or null
 */
export function useEthereumBridge(): OpenfortEthereumBridgeValue | null {
  return useContext(OpenfortEthereumBridgeContext)
}
