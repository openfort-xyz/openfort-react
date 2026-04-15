'use client'

import { OpenfortError } from '@openfort/openfort-js'
import { useCallback, useRef } from 'react'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext'
import { useOpenfortCore } from '../openfort/useOpenfort'
import { createSIWEMessage } from '../siwe/create-siwe-message'
import { logger } from '../utils/logger'

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
  const { client, user, updateUser } = useOpenfortCore()
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

      const address = propsAddress ?? b?.account?.address
      const connectorType = propsConnectorType ?? b?.account?.connector?.type
      const walletClientType = propsWalletClientType ?? b?.account?.connector?.id
      const chainId = b?.chainId
      const accountChainId = b?.account?.chain?.id ?? b?.chainId
      const chainName = b?.account?.chain?.name
      const switchChainAsync = b?.switchChain?.switchChainAsync
      const signMessage = b?.signMessage

      if (!address || !connectorType || !walletClientType) {
        logger.warn('[useConnectWithSiwe] Missing params', { address, connectorType, walletClientType })
        onError?.('No address found')
        return
      }

      // Reject SIWE when chainId is not a positive integer — signing with
      // chainId=0 / undefined produces a message that can be replayed across
      // chains that don't enforce the field.
      if (chainId === undefined || !Number.isInteger(chainId) || chainId <= 0) {
        logger.warn('[useConnectWithSiwe] Invalid chainId', { chainId })
        onError?.('No active chain. Connect your wallet to a supported network and try again.')
        return
      }
      const validChainId: number = chainId

      if (!signMessage) {
        logger.warn('[useConnectWithSiwe] No signMessage on bridge')
        onError?.('EVM bridge not available (signMessage)')
        return
      }

      try {
        if (accountChainId !== validChainId && switchChainAsync) {
          await switchChainAsync({ chainId: validChainId })
        }

        let nonce: string
        if (shouldLink) {
          const resp = await client.auth.initLinkSiwe({ address })
          nonce = resp.nonce
        } else {
          const resp = await client.auth.initSiwe({ address })
          nonce = resp.nonce
        }

        const SIWEMessage = createSIWEMessage(address, nonce, validChainId)
        if (!SIWEMessage) throw new Error('SIWE message creation failed (window not available)')

        const signature = await signMessage({ message: SIWEMessage })

        if (shouldLink) {
          await client.auth.linkWithSiwe({
            signature,
            message: SIWEMessage,
            connectorType,
            walletClientType,
            address,
            chainId: validChainId,
          })
        } else {
          await client.auth.loginWithSiwe({
            signature,
            message: SIWEMessage,
            connectorType,
            walletClientType,
            address,
          })
        }

        await updateUser()
        await Promise.resolve(onConnect?.())
      } catch (err) {
        logger.error('[useConnectWithSiwe] SIWE failed', {
          message: err instanceof Error ? err.message : String(err),
          status: (err as { response?: { status?: number } })?.response?.status,
        })
        if (!onError) return

        let message = err instanceof Error ? err.message : String(err)

        if (message.includes('User rejected the request.')) {
          message = 'User rejected the request.'
        } else if (message.includes('Invalid signature')) {
          message = 'Invalid signature. Please try again.'
        } else if (message.includes('An error occurred when attempting to switch chain')) {
          message = `Failed to switch chain. Please switch your wallet to ${chainName ?? 'the correct network'} and try again.`
        } else if (message.includes('already linked')) {
          message = 'This wallet is already linked to another account. Log out and connect with this wallet instead.'
        } else {
          message = 'Failed to connect with SIWE.'
        }

        onError(message, err instanceof OpenfortError ? err : undefined)
      }
    },
    [client, updateUser]
  )

  return { connectWithSiwe }
}
