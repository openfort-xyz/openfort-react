'use client'

import { useCallback, useRef, useState } from 'react'
import { type AuthorizationRequest, type Hex, parseSignature, type SignedAuthorization } from 'viem'
import { hashAuthorization } from 'viem/utils'
import { asOpenfortError, type OpenfortError } from '../../errors/base.js'
import { ClientNotInitializedError } from '../../errors/config.js'
import { MissingParameterError, ValidationError } from '../../errors/validation.js'
import { WalletError, WalletNotConnectedError } from '../../errors/wallet.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { assertEmbeddedEthereumAccount } from '../../shared/utils/assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'
import type { OpenfortHookOptions } from '../../types.js'
import { useLatest } from '../useLatest.js'
import { type BaseFlowState, mapStatus } from './auth/status.js'
import { onError, onSuccess } from './hookConsistency.js'

export type SignAuthorizationParameters = AuthorizationRequest

export type SignAuthorizationReturnType = SignedAuthorization

/**
 * The resolved result of an EIP-7702 authorization request.
 *
 * @example
 * ```ts
 * import type { SignAuthorizationResult } from '@openfort/react'
 *
 * function readAuthorization(result: SignAuthorizationResult) {
 *   if (result.status === 'error') return result.error.shortMessage
 *   return result.authorization.address
 * }
 * ```
 */
export type SignAuthorizationResult =
  | { status: 'success'; authorization: SignAuthorizationReturnType }
  | { status: 'error'; error: OpenfortError }

type SignAuthorizationSuccess = Extract<SignAuthorizationResult, { status: 'success' }>

/**
 * Per-request signing controls and lifecycle callbacks.
 *
 * @example
 * ```ts
 * import type { SignAuthorizationOptions } from '@openfort/react'
 *
 * const options: SignAuthorizationOptions = {
 *   hashMessage: false,
 *   onError: (error) => console.error(error.shortMessage),
 * }
 * ```
 */
export type SignAuthorizationOptions = OpenfortHookOptions<SignAuthorizationSuccess> & {
  hashMessage?: boolean
  arrayifyMessage?: boolean
  /**
   * Permits `chainId: 0`, which authorises the delegation on every EIP-7702
   * chain and never expires. Off by default: it is signed once and cannot be
   * narrowed afterwards.
   */
  allowAllChains?: boolean
}

/**
 * Hook-level lifecycle callbacks for EIP-7702 signing.
 *
 * @example
 * ```ts
 * import type { Use7702AuthorizationOptions } from '@openfort/react'
 *
 * const options: Use7702AuthorizationOptions = {
 *   onSuccess: ({ authorization }) => console.log(authorization.address),
 * }
 * ```
 */
export type Use7702AuthorizationOptions = OpenfortHookOptions<SignAuthorizationSuccess>

/**
 * Hook for signing EIP-7702 wallet authorizations
 *
 * This hook uses the embedded Openfort client to sign authorization payloads
 * prepared via viem while keeping private key management inside the SDK.
 * Calls resolve to either `{ authorization }` or `{ error }`.
 *
 * @returns Helper with a `signAuthorization` function that signs authorizations with the active Openfort wallet
 *
 * @example
 * ```tsx
 * import { use7702Authorization } from '@openfort/react'
 *
 * function AuthorizationButton() {
 *   const { signAuthorization, isLoading, error } = use7702Authorization()
 *
 *   const authorize = async () => {
 *     const result = await signAuthorization({
 *       contractAddress: '0x1111111111111111111111111111111111111111',
 *       chainId: 8453,
 *       nonce: 1,
 *     })
 *     if (result.status === 'error') return
 *     console.log(result.authorization)
 *   }
 *
 *   return <button onClick={authorize} disabled={isLoading}>{error ? error.shortMessage : 'Authorize'}</button>
 * }
 * ```
 */
export function use7702Authorization(hookOptions: Use7702AuthorizationOptions = {}) {
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const client = useOpenfortCore((s) => s.client)
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const activeEmbeddedAddress = useOpenfortCore((s) => s.activeEmbeddedAddress)
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const [status, setStatus] = useState<BaseFlowState>({ status: 'idle' })
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const [data, setData] = useState<SignAuthorizationReturnType | null>(null)
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const hookOptionsRef = useLatest(hookOptions)
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const latestInvocationRef = useRef(0)

  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const signAuthorization = useCallback(
    async (
      parameters: SignAuthorizationParameters,
      options: SignAuthorizationOptions = {}
    ): Promise<SignAuthorizationResult> => {
      const invocation = ++latestInvocationRef.current
      const requestHookOptions = { ...hookOptionsRef.current }
      const requestOptions = { ...options }
      setStatus({ status: 'loading' })
      try {
        if (!client) {
          throw new ClientNotInitializedError()
        }

        // viem types the delegate as `OneOf<{ address } | { contractAddress }>`,
        // and `signAuthorization(await prepareAuthorization(...))` — the canonical
        // flow — produces `address`. Reading only one of the two type-checked and
        // then threw at runtime.
        const delegate = parameters.contractAddress ?? parameters.address
        if (!delegate) {
          throw new MissingParameterError({ params: ['authorization.contractAddress'] })
        }
        const { address: _address, ...rest } = parameters as { address?: `0x${string}` }
        const authorization = { ...rest, contractAddress: delegate } as Parameters<typeof hashAuthorization>[0]

        // chainId 0 authorises the delegation on every chain, forever. It is a
        // valid EIP-7702 value but almost never what an application means, so it
        // has to be asked for rather than fallen into.
        // `!chainId`, not `=== 0`: viem encodes an absent chainId exactly as it
        // encodes 0, so a payload that simply omits it produces the same
        // every-chain delegation this gate exists to refuse.
        if (!authorization.chainId && !options.allowAllChains) {
          throw new ValidationError('Refusing to sign an authorization valid on every chain.', {
            details:
              'chainId 0 makes this delegation replayable on any EIP-7702 chain. Pass a specific chainId, or set `allowAllChains` if that is genuinely intended.',
          })
        }

        const hash = hashAuthorization(authorization)
        const intendedAddress = activeEmbeddedAddress
        if (!intendedAddress?.startsWith('0x')) {
          throw new WalletNotConnectedError('No active Ethereum wallet is available.')
        }
        const signature = await runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
          const provider = await client.embeddedWallet.getEthereumProvider({ announceProvider: false })
          assertCurrent()
          await assertEmbeddedEthereumAccount(provider, intendedAddress as `0x${string}`)
          assertCurrent()
          return client.embeddedWallet.signMessage(hash, {
            hashMessage: requestOptions.hashMessage ?? false,
            arrayifyMessage: requestOptions.arrayifyMessage ?? false,
          })
        })

        const { r, s, v, yParity } = parseSignature(signature as Hex)

        const authorizationResult = {
          address: authorization.contractAddress,
          chainId: authorization.chainId,
          nonce: authorization.nonce,
          r,
          s,
          v,
          yParity,
        } as SignAuthorizationReturnType

        if (latestInvocationRef.current === invocation) {
          setData(authorizationResult)
          setStatus({ status: 'success' })
        }
        return onSuccess({
          hookOptions: requestHookOptions,
          options: requestOptions,
          data: { status: 'success', authorization: authorizationResult },
        })
      } catch (error) {
        const openfortError = asOpenfortError(
          error,
          (cause) => new WalletError('Failed to sign authorization.', { cause })
        )
        if (latestInvocationRef.current === invocation) {
          setStatus({ status: 'error', error: openfortError })
        }
        return {
          status: 'error',
          ...onError({ hookOptions: requestHookOptions, options: requestOptions, error: openfortError }),
        }
      }
    },
    [client, activeEmbeddedAddress]
  )

  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const reset = useCallback(() => {
    latestInvocationRef.current += 1
    setStatus({ status: 'idle' })
    setData(null)
  }, [])

  return {
    signAuthorization,
    data,
    reset,
    ...mapStatus(status),
  }
}
