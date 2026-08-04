'use client'

import { useCallback, useRef } from 'react'
import { OpenfortError } from '../errors/base.js'
import { SiweMessageError } from '../errors/connection.js'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { useAuthTransitions } from '../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../openfort/useOpenfort.js'
import { createSIWEMessage } from '../siwe/create-siwe-message.js'
import { logger } from '../utils/logger.js'
import { getSiweErrorMessage, notifySiweCallback } from './siweCallbacks.js'

/**
 * Returns connectWithSiwe for linking external wallets via SIWE.
 *
 * @returns { connectWithSiwe }
 *
 * @example
 * ```tsx
 * const { connectWithSiwe } = useConnectWithSiwe()
 * await connectWithSiwe({ onConnect: () => router.replace('/dashboard') })
 * ```
 */
export function useConnectWithSiwe() {
  const client = useOpenfortCore((s) => s.client)
  const user = useOpenfortCore((s) => s.user)
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const { captureAuthSession, startAuthenticatedMutation, startAuthTransition } = useAuthTransitions()
  const bridge = useEthereumBridge()

  // Use a ref so the callback always reads the latest bridge state,
  // not a stale closure from the last render (critical after connectAsync changes the active connector).
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge

  const userRef = useRef(user)
  userRef.current = user

  const connectWithSiwe = useCallback(
    async ({
      onError,
      onConnect,
      address: propsAddress,
      connectorType: propsConnectorType,
      walletClientType: propsWalletClientType,
      link,
    }: {
      address?: `0x${string}`
      connectorType?: string
      walletClientType?: string
      onError?: (error: string, openfortError?: OpenfortError) => void
      onConnect?: () => void
      link?: boolean
    } = {}) => {
      // Read fresh values from the bridge ref — NOT from the stale render closure
      const b = bridgeRef.current
      const currentUser = userRef.current
      const shouldLink = link ?? !!currentUser
      const linkSession = shouldLink ? captureAuthSession() : undefined
      let linkMutationIsCurrent: (() => boolean) | undefined
      const isCurrentLink = () => !linkSession || (linkSession.isCurrent() && (linkMutationIsCurrent?.() ?? true))

      const address = propsAddress ?? b?.account?.address
      const connectorType = propsConnectorType ?? b?.account?.connector?.type
      const walletClientType = propsWalletClientType ?? b?.account?.connector?.id
      const chainId = b?.chainId ?? 0
      const accountChainId = b?.account?.chain?.id ?? b?.chainId
      const chainName = b?.account?.chain?.name
      const switchChainAsync = b?.switchChain?.switchChainAsync
      const signMessage = b?.signMessage

      if (!address || !connectorType || !walletClientType) {
        logger.warn('[useConnectWithSiwe] Missing params', { address, connectorType, walletClientType })
        notifySiweCallback(onError, 'onError', 'No address found')
        return
      }

      if (!signMessage) {
        logger.warn('[useConnectWithSiwe] No signMessage on bridge')
        notifySiweCallback(onError, 'onError', 'EVM bridge not available (signMessage)')
        return
      }

      if (!shouldLink) {
        let transitionIsCurrent = () => false
        const transition = startAuthTransition(async () => {
          if (!transitionIsCurrent()) return
          if (accountChainId !== chainId && switchChainAsync) {
            await switchChainAsync({ chainId })
            if (!transitionIsCurrent()) return
          }

          const { nonce } = await client.auth.initSiwe({ address })
          if (!transitionIsCurrent()) return
          const SIWEMessage = createSIWEMessage(address, nonce, chainId)
          if (!SIWEMessage) throw new SiweMessageError()

          const signature = await signMessage({ message: SIWEMessage })
          if (!transitionIsCurrent()) return
          await client.auth.loginWithSiwe({
            signature,
            message: SIWEMessage,
            connectorType,
            walletClientType,
            address,
          })
        })
        transitionIsCurrent = transition.isCurrent

        try {
          await transition.result
          if (!transition.isCurrent()) return
          await updateUser()
          if (!transition.isCurrent()) return
          notifySiweCallback(onConnect, 'onSuccess')
        } catch (err) {
          if (!transition.isCurrent()) return
          logger.error('[useConnectWithSiwe] SIWE failed', {
            message: err instanceof Error ? err.message : String(err),
            status: (err as { response?: { status?: number } })?.response?.status,
          })
          notifySiweCallback(
            onError,
            'onError',
            getSiweErrorMessage(err, chainName),
            err instanceof OpenfortError ? err : undefined
          )
        }
        return
      }

      try {
        if (accountChainId !== chainId && switchChainAsync) {
          await switchChainAsync({ chainId })
          if (!isCurrentLink()) return
        }

        const initTransition = startAuthenticatedMutation(() => client.auth.initLinkSiwe({ address }))
        linkMutationIsCurrent = initTransition.isCurrent
        const { nonce } = await initTransition.result
        if (!isCurrentLink()) return

        const SIWEMessage = createSIWEMessage(address, nonce, chainId)
        if (!SIWEMessage) throw new SiweMessageError()

        const signature = await signMessage({ message: SIWEMessage })
        if (!isCurrentLink()) return

        const linkTransition = startAuthenticatedMutation(() =>
          client.auth.linkWithSiwe({
            signature,
            message: SIWEMessage,
            connectorType,
            walletClientType,
            address,
            chainId,
          })
        )
        linkMutationIsCurrent = linkTransition.isCurrent
        await linkTransition.result
        if (!isCurrentLink()) return
        await updateUser()
        if (!isCurrentLink()) return

        notifySiweCallback(onConnect, 'onSuccess')
      } catch (err) {
        if (!isCurrentLink()) return
        logger.error('[useConnectWithSiwe] SIWE failed', {
          message: err instanceof Error ? err.message : String(err),
          status: (err as { response?: { status?: number } })?.response?.status,
        })
        notifySiweCallback(
          onError,
          'onError',
          getSiweErrorMessage(err, chainName),
          err instanceof OpenfortError ? err : undefined
        )
      }
    },
    [captureAuthSession, client, startAuthenticatedMutation, startAuthTransition, updateUser]
  )

  return { connectWithSiwe }
}
