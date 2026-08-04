'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { embeddedWalletId } from '../constants/openfort.js'
import { AuthenticationError } from '../errors/auth.js'
import { OpenfortError, toError } from '../errors/base.js'
import { ConnectorNotFoundError, SiweMessageError } from '../errors/connection.js'
import { type OpenfortEthereumBridgeConnector, useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { type BaseFlowState, mapStatus } from '../hooks/openfort/auth/status.js'
import { onError, onSuccess } from '../hooks/openfort/hookConsistency.js'
import { useAuthTransitions } from '../openfort/authTransitionContext.js'
import type { OpenfortCoreContextValue } from '../openfort/CoreOpenfortProvider.js'
import { useOpenfortCore } from '../openfort/useOpenfort.js'
import type { AuthSession } from '../shared/utils/authTransitionQueue.js'
import { createSIWEMessage } from '../siwe/create-siwe-message.js'
import type { OpenfortHookOptions } from '../types.js'
import { logger } from '../utils/logger.js'
import { getSiweErrorMessage, notifySiweCallback } from './siweCallbacks.js'

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
  openfort: Pick<OpenfortCoreContextValue, 'client' | 'updateUser'> &
    Pick<ReturnType<typeof useAuthTransitions>, 'startAuthenticatedMutation'>,
  params: {
    address?: `0x${string}`
    connectorType?: string
    walletClientType?: string
    link: boolean
    session: AuthSession
    onConnect?: () => void
    onError?: (error: string, openfortError?: OpenfortError) => void
    onStale?: () => void
  }
): Promise<void> {
  const { client, startAuthenticatedMutation, updateUser } = openfort
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
    notifySiweCallback(params.onError, 'onError', 'No address found')
    return Promise.resolve()
  }
  if (!signMessage) {
    logger.warn('[runConnectWithSiwe] No signMessage on bridge')
    notifySiweCallback(params.onError, 'onError', 'EVM bridge not available (signMessage)')
    return Promise.resolve()
  }

  return (async () => {
    let linkMutationIsCurrent: (() => boolean) | undefined
    const settleStale = () => {
      const current = params.session.isCurrent() && (!params.link || (linkMutationIsCurrent?.() ?? true))
      if (current) return false
      params.onStale?.()
      return true
    }
    try {
      if (accountChainId !== chainId && switchChainAsync) {
        await switchChainAsync({ chainId })
        if (settleStale()) return
      }
      let nonce: string
      if (params.link) {
        const transition = startAuthenticatedMutation(() => client.auth.initLinkSiwe({ address }))
        linkMutationIsCurrent = transition.isCurrent
        nonce = (await transition.result).nonce
      } else {
        nonce = (await client.auth.initSiwe({ address })).nonce
      }
      if (settleStale()) return
      const siweMsg = createSIWEMessage(address, nonce, chainId)
      if (!siweMsg) throw new SiweMessageError()
      const messageStr =
        typeof siweMsg === 'string'
          ? siweMsg
          : typeof (siweMsg as { prepareMessage?: () => Promise<string> }).prepareMessage === 'function'
            ? await (siweMsg as { prepareMessage: () => Promise<string> }).prepareMessage()
            : String(siweMsg)
      if (settleStale()) return
      const signature = await signMessage({ message: messageStr })
      if (settleStale()) return
      if (params.link) {
        const transition = startAuthenticatedMutation(() =>
          client.auth.linkWithSiwe({
            signature,
            message: messageStr,
            connectorType,
            walletClientType,
            address,
            chainId,
          })
        )
        linkMutationIsCurrent = transition.isCurrent
        await transition.result
        if (settleStale()) return
        await updateUser()
        if (settleStale()) return
      } else {
        await client.auth.loginWithSiwe({
          signature,
          message: messageStr,
          connectorType,
          walletClientType,
          address,
        })
        if (settleStale()) return
        await updateUser()
        if (settleStale()) return
      }
      notifySiweCallback(params.onConnect, 'onSuccess')
    } catch (err) {
      if (settleStale()) return
      logger.error('[runConnectWithSiwe] SIWE failed', err instanceof Error ? err.message : err)
      notifySiweCallback(
        params.onError,
        'onError',
        getSiweErrorMessage(err, chainName),
        err instanceof OpenfortError ? err : undefined
      )
    }
  })()
}

const DEFAULT_WALLET_AUTH_HOOK_OPTIONS: OpenfortHookOptions = {}

export function useWalletAuth(hookOptions: OpenfortHookOptions = DEFAULT_WALLET_AUTH_HOOK_OPTIONS) {
  const bridge = useEthereumBridge()
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession, startAuthenticatedMutation, startAuthTransition } = useAuthTransitions()
  const updateUser = useOpenfortCore((s) => s.updateUser)

  const [walletConnectingTo, setWalletConnectingTo] = useState<string | null>(null)
  const [status, setStatus] = useState<BaseFlowState>({ status: 'idle' })
  const latestInvocationRef = useRef(0)

  const availableWallets = useMemo((): AvailableWallet[] => {
    if (!bridge?.connectors?.length) return []
    return bridge.connectors
      .filter((c) => c.id !== embeddedWalletId)
      .map((c) => ({ id: c.id, name: c.name ?? c.id, icon: c.icon, connector: c }))
  }, [bridge?.connectors])

  const runConnectThenSiwe = useCallback(
    async (connectorId: string, link: boolean, callbacks?: WalletAuthCallbacks) => {
      const connector = bridge?.connectors?.find((c) => c.id === connectorId)
      const connectAsync = bridge?.connectAsync
      if (!connector || !connectAsync) {
        logger.warn('[useWalletAuth] Connector not found', { connectorId })
        const err = new ConnectorNotFoundError({ connectorId })
        const msg = err.shortMessage
        setStatus({ status: 'error', error: err })
        onError({ hookOptions, error: err })
        notifySiweCallback(callbacks?.onError, 'onError', msg, err)
        return
      }

      setWalletConnectingTo(connectorId)
      setStatus({ status: 'loading' })
      const invocation = ++latestInvocationRef.current
      let operationErrorMessage = bridge.account.isConnected ? 'Failed to disconnect.' : 'Failed to connect wallet.'
      const settleStale = () => {
        if (latestInvocationRef.current !== invocation) return
        setWalletConnectingTo(null)
        setStatus({ status: 'idle' })
      }
      const handleError = (cause: unknown, message: string) => {
        logger.error('[useWalletAuth] connection failed', cause instanceof Error ? cause.message : cause)
        setWalletConnectingTo(null)
        const error = new AuthenticationError(message, { cause: toError(cause) })
        setStatus({ status: 'error', error })
        onError({ hookOptions, error })
        notifySiweCallback(callbacks?.onError, 'onError', cause instanceof Error ? cause.message : message, error)
      }
      const run = async (session: AuthSession) => {
        if (!session.isCurrent()) return settleStale()
        if (bridge.account.isConnected) {
          await bridge.disconnect()
          if (!session.isCurrent()) return settleStale()
        }

        operationErrorMessage = 'Failed to connect wallet.'
        const result = await connectAsync({ connector })
        if (!session.isCurrent()) return settleStale()
        const connectResult =
          result && typeof result === 'object' && 'accounts' in result
            ? (result as { accounts: readonly `0x${string}`[]; chainId: number })
            : undefined
        const addressFromResult = connectResult?.accounts?.[0]
        await runConnectWithSiwe(
          bridge,
          { client, startAuthenticatedMutation, updateUser },
          {
            address: addressFromResult,
            connectorType: connector.type,
            walletClientType: connector.id,
            link,
            session,
            onStale: settleStale,
            onConnect: () => {
              if (!session.isCurrent()) return settleStale()
              setWalletConnectingTo(null)
              setStatus({ status: 'success' })
              onSuccess({ hookOptions, data: {} })
              notifySiweCallback(callbacks?.onConnect, 'onSuccess')
            },
            onError: (message: string, openfortError?: OpenfortError) => {
              if (!session.isCurrent()) return settleStale()
              setWalletConnectingTo(null)
              const error = openfortError ?? new AuthenticationError(message)
              setStatus({ status: 'error', error })
              onError({ hookOptions, error })
              notifySiweCallback(callbacks?.onError, 'onError', message, error)
            },
          }
        )
      }

      if (link) {
        const authSession = captureAuthSession()
        const session = {
          isCurrent: () => authSession.isCurrent() && latestInvocationRef.current === invocation,
        }
        try {
          await run(session)
        } catch (error) {
          if (!session.isCurrent()) return settleStale()
          handleError(error, operationErrorMessage)
        }
        return
      }

      let transitionIsCurrent = () => false
      const transition = startAuthTransition(() =>
        run({
          isCurrent: () => transitionIsCurrent() && latestInvocationRef.current === invocation,
        })
      )
      transitionIsCurrent = transition.isCurrent
      try {
        await transition.result
        if (!transitionIsCurrent()) settleStale()
      } catch (error) {
        if (!transitionIsCurrent()) return settleStale()
        handleError(error, operationErrorMessage)
      }
    },
    [bridge, client, captureAuthSession, startAuthenticatedMutation, startAuthTransition, updateUser, hookOptions]
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
