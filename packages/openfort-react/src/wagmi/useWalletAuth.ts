'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { embeddedWalletId } from '../constants/openfort.js'
import { AuthenticationError } from '../errors/auth.js'
import { type OpenfortError, toError } from '../errors/base.js'
import { ConnectorNotFoundError } from '../errors/connection.js'
import { type OpenfortEthereumBridgeConnector, useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { type BaseFlowState, mapStatus } from '../hooks/openfort/auth/status.js'
import { NO_HOOK_OPTIONS, onError, onSuccess } from '../hooks/openfort/hookConsistency.js'
import { useAuthTransitions } from '../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../openfort/useOpenfort.js'
import type { AuthSession } from '../shared/utils/authTransitionQueue.js'
import type { OpenfortHookOptions } from '../types.js'
import { logger } from '../utils/logger.js'
import { notifySiweCallback, resolveSiweInputs, runSiweFlow } from './siweFlow.js'

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

export function useWalletAuth(hookOptions: OpenfortHookOptions = NO_HOOK_OPTIONS) {
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
        const reportSiweError = (message: string, openfortError?: OpenfortError) => {
          if (!session.isCurrent()) return settleStale()
          setWalletConnectingTo(null)
          const error = openfortError ?? new AuthenticationError(message)
          setStatus({ status: 'error', error })
          onError({ hookOptions, error })
          notifySiweCallback(callbacks?.onError, 'onError', message, error)
        }

        const inputs = resolveSiweInputs(bridge, {
          address: addressFromResult,
          connectorType: connector.type,
          walletClientType: connector.id,
        })
        if (typeof inputs === 'string') return reportSiweError(inputs)

        await runSiweFlow(
          inputs,
          { client, startAuthenticatedMutation, updateUser },
          {
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
            onError: reportSiweError,
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
