'use client'

import {
  getEnsAddress as getEnsAddressAction,
  getEnsAvatar as getEnsAvatarAction,
  getEnsName as getEnsNameAction,
} from '@wagmi/core'
import type React from 'react'
import { createElement, type PropsWithChildren, useCallback, useMemo, useRef } from 'react'
import { normalize } from 'viem/ens'
import {
  useAccount,
  useChainId,
  useConfig,
  useConnect,
  useDisconnect,
  useEnsAvatar,
  useEnsName,
  useSignMessage,
  useSwitchChain,
  useWalletClient,
} from 'wagmi'
import {
  type OpenfortEthereumBridgeConnector,
  OpenfortEthereumBridgeContext,
  type OpenfortEthereumBridgeValue,
} from '../ethereum/OpenfortEthereumBridgeContext'
import { shouldExcludeConnector } from './connectorFilter'

function mapConnector(c: {
  id: string
  name: string
  icon?: string
  type?: string
  getProvider?: () => Promise<unknown>
}): OpenfortEthereumBridgeConnector {
  return { id: c.id, name: c.name, icon: c.icon, type: c.type, getProvider: c.getProvider }
}

export const OpenfortWagmiBridge: React.FC<PropsWithChildren> = ({ children }) => {
  const { address, chain, isConnected, isConnecting, isReconnecting, connector } = useAccount()
  const chainId = useChainId()
  const config = useConfig()
  const { disconnectAsync } = useDisconnect()
  const { connect, connectAsync: wagmiConnectAsync, connectors, reset } = useConnect()
  const {
    chains,
    switchChain,
    switchChainAsync,
    isPending: isSwitchChainPending,
    error: switchChainError,
  } = useSwitchChain()
  const { signMessageAsync } = useSignMessage()
  const { data: walletClient } = useWalletClient()

  const accountAddress: `0x${string}` | undefined = walletClient?.account?.address ?? address

  const { data: ensName } = useEnsName({ address: accountAddress, chainId: 1 })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName ? normalize(ensName) : undefined, chainId: 1 })

  const connectorKey = connectors.map((c) => c.id).join(',')
  const connectorsRef = useRef(connectors)
  if (connectorsRef.current.map((c) => c.id).join(',') !== connectorKey) {
    connectorsRef.current = connectors
  }
  const stableConnectors = connectorsRef.current

  const bridgeConnectors: OpenfortEthereumBridgeConnector[] = useMemo(() => {
    const mapped = stableConnectors.map((c) => mapConnector(c))
    return mapped
      .filter((w, i, self) => self.findIndex((x) => x.id === w.id) === i)
      .filter((w) => !shouldExcludeConnector(w, mapped))
  }, [stableConnectors])

  const connectBridge = useCallback(
    (params: { connector: OpenfortEthereumBridgeConnector }) => {
      const c = stableConnectors.find((x) => x.id === params.connector.id)
      if (c) connect({ connector: c })
    },
    [stableConnectors, connect]
  )

  const connectAsyncBridge = useCallback(
    async (params: { connector: OpenfortEthereumBridgeConnector }) => {
      const c = stableConnectors.find((x) => x.id === params.connector.id)
      if (!c) throw new Error('Connector not found')
      return wagmiConnectAsync({ connector: c })
    },
    [stableConnectors, wagmiConnectAsync]
  )

  const getEnsAddress = useCallback(
    async (name: string): Promise<`0x${string}` | undefined> => {
      try {
        return (await getEnsAddressAction(config, { name: normalize(name), chainId: 1 })) ?? undefined
      } catch {
        return undefined
      }
    },
    [config]
  )

  const getEnsName = useCallback(
    async (params: { address: `0x${string}` }): Promise<string | undefined> => {
      try {
        return (await getEnsNameAction(config, { address: params.address, chainId: 1 })) ?? undefined
      } catch {
        return undefined
      }
    },
    [config]
  )

  const getEnsAvatar = useCallback(
    async (name: string): Promise<string | undefined> => {
      try {
        return (await getEnsAvatarAction(config, { name: normalize(name), chainId: 1 })) ?? undefined
      } catch {
        return undefined
      }
    },
    [config]
  )

  const getConnectorAccounts = useCallback(
    async (connectorBridge: OpenfortEthereumBridgeConnector): Promise<`0x${string}`[]> => {
      const c = stableConnectors.find((x) => x.id === connectorBridge.id)
      if (!c?.getAccounts) return []
      const accounts = await c.getAccounts()
      return accounts as `0x${string}`[]
    },
    [stableConnectors]
  )

  const signMessage = useCallback(
    async (params: { message: string }): Promise<`0x${string}`> => {
      if (!signMessageAsync) throw new Error('signMessage not available')
      return signMessageAsync({ message: params.message })
    },
    [signMessageAsync]
  )

  const getWalletClient = useCallback(async () => walletClient ?? undefined, [walletClient])

  const value: OpenfortEthereumBridgeValue = useMemo(
    () => ({
      account: {
        address: accountAddress,
        chain: chain ? { id: chain.id, name: chain.name } : undefined,
        isConnected: (isConnected ?? false) && !isConnecting && !isReconnecting,
        isConnecting: isConnecting ?? false,
        isReconnecting: isReconnecting ?? false,
        connector: connector ? mapConnector(connector) : undefined,
        ensName: ensName ?? undefined,
        ensAvatar: ensAvatar ?? undefined,
      },
      chainId,
      config: {
        chains: config.chains.map((ch) => ({ id: ch.id })),
        getClient: (opts) => {
          const client = config.getClient({ chainId: opts.chainId })
          return {
            transport: {
              url: (client as { transport?: { url?: string } })?.transport?.url ?? '',
            },
          }
        },
        storage: config.storage
          ? {
              getItem: (key: string) => Promise.resolve(config.storage?.getItem(key) ?? null),
              setItem: (key: string, value: string) => config.storage?.setItem(key, value),
            }
          : undefined,
      },
      disconnect: disconnectAsync,
      connect: connectBridge,
      connectAsync: connectAsyncBridge,
      reset,
      connectors: bridgeConnectors,
      switchChain: {
        chains: chains.map((ch) => ({ id: ch.id, name: ch.name })),
        switchChain: switchChain ?? undefined,
        switchChainAsync,
        isPending: isSwitchChainPending,
        error: switchChainError ?? null,
      },
      getEnsAddress,
      getEnsName,
      getEnsAvatar,
      getConnectorAccounts,
      signMessage,
      getWalletClient,
    }),
    [
      accountAddress,
      chain,
      isConnected,
      isConnecting,
      isReconnecting,
      connector,
      chainId,
      config,
      disconnectAsync,
      connectBridge,
      connectAsyncBridge,
      reset,
      bridgeConnectors,
      chains,
      switchChain,
      isSwitchChainPending,
      switchChainError,
      ensName,
      ensAvatar,
      getEnsAddress,
      getEnsName,
      getEnsAvatar,
      getConnectorAccounts,
      signMessage,
      getWalletClient,
    ]
  )

  return createElement(OpenfortEthereumBridgeContext.Provider, { value }, children)
}
