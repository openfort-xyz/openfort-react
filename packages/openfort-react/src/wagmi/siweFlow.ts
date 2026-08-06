import { UserRejectedRequestError } from 'viem'
import { OpenfortError, toError } from '../errors/base.js'
import { SiweMessageError } from '../errors/connection.js'
import type { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext.js'
import { notifyHookCallback } from '../hooks/openfort/hookConsistency.js'
import type { useAuthTransitions } from '../openfort/authTransitionContext.js'
import type { OpenfortCoreContextValue } from '../openfort/CoreOpenfortProvider.js'
import type { AuthSession } from '../shared/utils/authTransitionQueue.js'
import { createSIWEMessage } from '../siwe/create-siwe-message.js'
import { matchesErrorClass } from '../utils/errorHandling.js'
import { logger } from '../utils/logger.js'

type SiweBridge = NonNullable<ReturnType<typeof useEthereumBridge>>

type SiweOpenfort = Pick<OpenfortCoreContextValue, 'client' | 'updateUser'> &
  Pick<ReturnType<typeof useAuthTransitions>, 'startAuthenticatedMutation'>

/** Maps SIWE failures to the current consumer-facing message. */
export function getSiweErrorMessage(error: unknown, chainName: string | undefined): string {
  if (matchesErrorClass(error, [UserRejectedRequestError])) return 'User rejected the request.'
  const message = toError(error).message
  if (message.includes('User rejected the request.')) return 'User rejected the request.'
  if (message.includes('Invalid signature')) return 'Invalid signature. Please try again.'
  if (message.includes('An error occurred when attempting to switch chain')) {
    return `Failed to switch chain. Please switch your wallet to ${chainName ?? 'the correct network'} and try again.`
  }
  if (message.includes('already linked')) {
    return 'This wallet is already linked to another account. Log out and connect with this wallet instead.'
  }
  return 'Failed to connect with SIWE.'
}

/** Adapts zero- and multi-argument SIWE callbacks to the shared hook callback boundary. */
export function notifySiweCallback<TArgs extends unknown[]>(
  callback: ((...args: TArgs) => unknown) | undefined,
  callbackName: 'onSuccess' | 'onError',
  ...args: TArgs
): void {
  notifyHookCallback(callback ? () => callback(...args) : undefined, undefined, callbackName)
}

/** Everything the SIWE flow reads, resolved from the bridge and the caller's overrides. */
type SiweInputs = {
  address: `0x${string}`
  connectorType: string
  walletClientType: string
  chainId: number
  accountChainId: number | undefined
  chainName: string | undefined
  switchChainAsync: SiweBridge['switchChain']['switchChainAsync'] | undefined
  signMessage: NonNullable<SiweBridge['signMessage']>
}

/**
 * Resolves the values the SIWE flow needs, or returns the message explaining why
 * it cannot run. Callers report that message before opening an auth transition,
 * so a missing parameter never invalidates the current principal.
 */
export function resolveSiweInputs(
  bridge: SiweBridge | null | undefined,
  overrides: { address?: `0x${string}`; connectorType?: string; walletClientType?: string }
): SiweInputs | string {
  const address = overrides.address ?? bridge?.account?.address
  const connectorType = overrides.connectorType ?? bridge?.account?.connector?.type
  const walletClientType = overrides.walletClientType ?? bridge?.account?.connector?.id
  const signMessage = bridge?.signMessage

  if (!address || !connectorType || !walletClientType) {
    logger.warn('[siwe] Missing params', { address, connectorType, walletClientType })
    return 'No address found'
  }
  if (!signMessage) {
    logger.warn('[siwe] No signMessage on bridge')
    return 'EVM bridge not available (signMessage)'
  }

  return {
    address,
    connectorType,
    walletClientType,
    chainId: bridge?.chainId ?? 0,
    accountChainId: bridge?.account?.chain?.id ?? bridge?.chainId,
    chainName: bridge?.account?.chain?.name,
    switchChainAsync: bridge?.switchChain?.switchChainAsync,
    signMessage,
  }
}

/**
 * Runs the SIWE handshake — switch chain, request a nonce, sign, submit — and
 * reports the outcome through the callbacks.
 *
 * Login and link differ only in which pair of `client.auth` calls they make and
 * in link's need to run them as authenticated mutations, so both share this body.
 * The flow never rejects: a failure reaches the consumer through `onError`.
 */
export async function runSiweFlow(
  inputs: SiweInputs,
  openfort: SiweOpenfort,
  params: {
    link: boolean
    session: AuthSession
    onConnect?: () => void
    onError?: (error: string, openfortError?: OpenfortError) => void
    onStale?: () => void
  }
): Promise<void> {
  const { client, startAuthenticatedMutation, updateUser } = openfort
  const { address, connectorType, walletClientType, chainId } = inputs
  let linkMutationIsCurrent: (() => boolean) | undefined
  const settleStale = () => {
    const current = params.session.isCurrent() && (!params.link || (linkMutationIsCurrent?.() ?? true))
    if (current) return false
    params.onStale?.()
    return true
  }

  try {
    if (settleStale()) return
    if (inputs.accountChainId !== chainId && inputs.switchChainAsync) {
      await inputs.switchChainAsync({ chainId })
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

    const message = createSIWEMessage(address, nonce, chainId)
    if (!message) throw new SiweMessageError()

    const signature = await inputs.signMessage({ message })
    if (settleStale()) return

    if (params.link) {
      const transition = startAuthenticatedMutation(() =>
        client.auth.linkWithSiwe({ signature, message, connectorType, walletClientType, address, chainId })
      )
      linkMutationIsCurrent = transition.isCurrent
      await transition.result
    } else {
      await client.auth.loginWithSiwe({ signature, message, connectorType, walletClientType, address })
    }
    if (settleStale()) return

    await updateUser()
    if (settleStale()) return

    notifySiweCallback(params.onConnect, 'onSuccess')
  } catch (err) {
    if (settleStale()) return
    logger.error('[siwe] SIWE failed', err instanceof Error ? err.message : err)
    notifySiweCallback(
      params.onError,
      'onError',
      getSiweErrorMessage(err, inputs.chainName),
      err instanceof OpenfortError ? err : undefined
    )
  }
}
