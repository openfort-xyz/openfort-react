'use client'

import { useCallback, useRef } from 'react'
import type { OpenfortError } from '../errors/base.js'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { useAuthTransitions } from '../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../openfort/useOpenfort.js'
import { notifySiweCallback, resolveSiweInputs, runSiweFlow } from './siweFlow.js'

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
      const shouldLink = link ?? !!userRef.current
      const inputs = resolveSiweInputs(bridgeRef.current, {
        address: propsAddress,
        connectorType: propsConnectorType,
        walletClientType: propsWalletClientType,
      })
      if (typeof inputs === 'string') {
        notifySiweCallback(onError, 'onError', inputs)
        return
      }

      const openfort = { client, updateUser, startAuthenticatedMutation }
      if (shouldLink) {
        await runSiweFlow(inputs, openfort, { link: true, session: captureAuthSession(), onConnect, onError })
        return
      }

      // Logging in replaces the principal, so the whole handshake runs inside an
      // auth transition and stops the moment a newer one supersedes it.
      let transitionIsCurrent = () => false
      const transition = startAuthTransition(() =>
        runSiweFlow(inputs, openfort, {
          link: false,
          session: { isCurrent: () => transitionIsCurrent() },
          onConnect,
          onError,
        })
      )
      transitionIsCurrent = transition.isCurrent
      await transition.result
    },
    [captureAuthSession, client, startAuthenticatedMutation, startAuthTransition, updateUser]
  )

  return { connectWithSiwe }
}
