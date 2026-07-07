'use client'

import { useCallback, useMemo, useState } from 'react'
import { embeddedWalletId } from '../constants/openfort'
import { OpenfortError, OpenfortReactErrorType } from '../core/errors'
import { type OpenfortEthereumBridgeConnector, useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext'
import { type BaseFlowState, mapStatus } from '../hooks/openfort/auth/status'
import { onError, onSuccess } from '../hooks/openfort/hookConsistency'
import { useOpenfortCore } from '../openfort/useOpenfort'
import { createSIWEMessage } from '../siwe/create-siwe-message'
import type { OpenfortHookOptions } from '../types'
import { logger } from '../utils/logger'

export interface AvailableWallet {
  id: string
  name: string
  icon?: string
  connector: OpenfortEthereumBridgeConnector
}

interface WalletAuthCallbacks {
  onConnect?: () => void
  onError?: (error: string, openfortError?: OpenfortError) => void
}

function runConnectWithSiwe(
  bridge: NonNullable<ReturnType<typeof useEthereumBridge>>,
  openfort: ReturnType<typeof useOpenfortCore>,
  params: {
    address?: `0x${string}`
    connectorType?: string
    walletClientType?: string
    link: boolean
    onConnect?: () => void
    onError?: (error: string, openfortError?: OpenfortError) => void
  }
): Promise<void> {
  const { client, updateUser } = openfort
  const address = params.address ?? bridge.account?.address
  const connectorType = params.connectorType ?? bridge.account?.connector?.type
  const walletClientType = params.walletClientType ?? bridge.account?.connector?.id
  const chainId = bridge.chainId ?? 0
  const accountChainId = bridge.account?.chain?.id ?? bridge.chainId
  const chainName = bridge.account?.chain?.name
  const switchChainAsync = bridge.switchChain?.switchChainAsync
  const signMessage = bridge.signMessage

  if (!address || !connectorType || !walletClientType) {
    logger.warn('[runConnectWithSiwe] Missing params', { address, connectorType, walletClientType })
    params.onError?.('No address found')
    return Promise.resolve()
  }
  if (!signMessage) {
    logger.warn('[runConnectWithSiwe] No signMessage on bridge')
    params.onError?.('EVM bridge not available (signMessage)')
    return Promise.resolve()
  }

  return (async () => {
    try {
      if (accountChainId !== chainId && switchChainAsync) {
        await switchChainAsync({ chainId })
      }
      const nonce = params.link
        ? (await client.auth.initLinkSiwe({ address })).nonce
        : (await client.auth.initSiwe({ address, chainId })).nonce
      const siweMsg = createSIWEMessage(address, nonce, chainId)
      if (!siweMsg) throw new Error('SIWE message creation failed (window not available)')
      const messageStr =
        typeof siweMsg === 'string'
          ? siweMsg
          : typeof (siweMsg as { prepareMessage?: () => Promise<string> }).prepareMessage === 'function'
            ? await (siweMsg as { prepareMessage: () => Promise<string> }).prepareMessage()
            : String(siweMsg)
      const signature = await signMessage({ message: messageStr })
      if (params.link) {
        await client.auth.linkWithSiwe({
          signature,
          message: messageStr,
          connectorType,
          walletClientType,
          address,
          chainId,
        })
      } else {
        await client.auth.loginWithSiwe({
          signature,
          message: messageStr,
          connectorType,
          walletClientType,
          address,
          chainId,
        })
      }
      await updateUser()
      params.onConnect?.()
    } catch (err) {
      logger.error('[runConnectWithSiwe] SIWE failed', err instanceof Error ? err.message : err)
      if (!params.onError) return
      let message = err instanceof Error ? err.message : String(err)
      if (message.includes('User rejected the request.')) message = 'User rejected the request.'
      else if (message.includes('Invalid signature')) message = 'Invalid signature. Please try again.'
      else if (message.includes('An error occurred when attempting to switch chain')) {
        message = `Failed to switch chain. Please switch your wallet to ${chainName ?? 'the correct network'} and try again.`
      } else if (message.includes('already linked')) {
        message = 'This wallet is already linked to another account. Log out and connect with this wallet instead.'
      } else {
        message = 'Failed to connect with SIWE.'
      }
      params.onError(message, err instanceof OpenfortError ? err : undefined)
    }
  })()
}

export function useWalletAuth(hookOptions: OpenfortHookOptions = {}) {
  const bridge = useEthereumBridge()
  const openfort = useOpenfortCore()

  const [walletConnectingTo, setWalletConnectingTo] = useState<string | null>(null)
  const [status, setStatus] = useState<BaseFlowState>({ status: 'idle' })

  const availableWallets = useMemo((): AvailableWallet[] => {
    if (!bridge?.connectors?.length) return []
    return bridge.connectors
      .filter((c) => c.id !== embeddedWalletId)
      .map((c) => ({ id: c.id, name: c.name ?? c.id, icon: c.icon, connector: c }))
  }, [bridge?.connectors])

  const runConnectThenSiwe = useCallback(
    async (connectorId: string, link: boolean, callbacks?: WalletAuthCallbacks) => {
      const connector = bridge?.connectors?.find((c) => c.id === connectorId)
      if (!connector || !bridge?.connectAsync) {
        const msg = 'Connector not available'
        logger.warn('[useWalletAuth] Connector not found', { connectorId })
        const err = new OpenfortError(msg, OpenfortReactErrorType.AUTHENTICATION_ERROR)
        setStatus({ status: 'error', error: err })
        onError({ hookOptions, error: err })
        callbacks?.onError?.(msg, err)
        return
      }

      setWalletConnectingTo(connectorId)
      setStatus({ status: 'loading' })

      if (bridge.account.isConnected) {
        try {
          await bridge.disconnect()
        } catch (e) {
          logger.error('[useWalletAuth] Failed to disconnect', e)
          setWalletConnectingTo(null)
          const err = new OpenfortError('Failed to disconnect', OpenfortReactErrorType.AUTHENTICATION_ERROR, {
            error: e,
          })
          setStatus({ status: 'error', error: err })
          onError({ hookOptions, error: err })
          callbacks?.onError?.(err.message, err)
          return
        }
      }

      try {
        const result = await bridge.connectAsync({ connector })
        const connectResult =
          result && typeof result === 'object' && 'accounts' in result
            ? (result as { accounts: readonly `0x${string}`[]; chainId: number })
            : undefined
        const addressFromResult = connectResult?.accounts?.[0]
        await runConnectWithSiwe(bridge, openfort, {
          address: addressFromResult,
          connectorType: connector.type,
          walletClientType: connector.id,
          link,
          onConnect: () => {
            setWalletConnectingTo(null)
            setStatus({ status: 'success' })
            onSuccess({ hookOptions, data: {} })
            callbacks?.onConnect?.()
          },
          onError: (message: string, openfortError?: OpenfortError) => {
            setWalletConnectingTo(null)
            const err = openfortError ?? new OpenfortError(message, OpenfortReactErrorType.AUTHENTICATION_ERROR)
            setStatus({ status: 'error', error: err })
            onError({ hookOptions, error: err })
            callbacks?.onError?.(message, err)
          },
        })
      } catch (err) {
        logger.error('[useWalletAuth] connectAsync failed', err instanceof Error ? err.message : err)
        setWalletConnectingTo(null)
        const message = err instanceof Error ? err.message : 'Connection failed'
        const openfortErr = new OpenfortError(message, OpenfortReactErrorType.AUTHENTICATION_ERROR, { error: err })
        setStatus({ status: 'error', error: openfortErr })
        onError({ hookOptions, error: openfortErr })
        callbacks?.onError?.(message, openfortErr)
      }
    },
    [bridge, openfort, hookOptions]
  )

  const connectWallet = useCallback(
    (connectorId: string, callbacks?: WalletAuthCallbacks) => runConnectThenSiwe(connectorId, false, callbacks),
    [runConnectThenSiwe]
  )

  const linkWallet = useCallback(
    (connectorId: string, callbacks?: WalletAuthCallbacks) => runConnectThenSiwe(connectorId, true, callbacks),
    [runConnectThenSiwe]
  )

  return {
    availableWallets,
    connectWallet,
    linkWallet,
    walletConnectingTo,
    ...mapStatus(status),
  }
}
