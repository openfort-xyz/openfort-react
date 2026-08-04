'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { routes, type SignRequest, type SignTypedDataPayload } from '../../components/Openfort/types.js'
import { useOpenfortRouting, useOpenfortSignRequest } from '../../components/Openfort/useOpenfort.js'
import type { OpenfortError } from '../../errors/base.js'
import { WalletError } from '../../errors/wallet.js'
import type { OpenfortHookOptions } from '../../types.js'
import { onError, onSuccess } from './hookConsistency.js'

type SignArgs = { kind: 'message'; message: string } | { kind: 'typedData'; typedData: SignTypedDataPayload }

/**
 * The resolved result of a modal signing request.
 *
 * @example
 * ```ts
 * import type { SignMessageResult } from '@openfort/react'
 *
 * function readSignature(result: SignMessageResult) {
 *   return 'error' in result ? result.error.shortMessage : result.signature
 * }
 * ```
 */
export type SignMessageResult = { signature: string } | { error: OpenfortError }

type SignMessageSuccess = Extract<SignMessageResult, { signature: string }>

/**
 * Lifecycle callbacks for modal signing requests.
 *
 * @example
 * ```ts
 * import type { UseSignMessageOptions } from '@openfort/react'
 *
 * const options: UseSignMessageOptions = {
 *   onError: (error) => console.error(error.shortMessage),
 * }
 * ```
 */
export type UseSignMessageOptions = OpenfortHookOptions<SignMessageSuccess>

const DEFAULT_SIGN_MESSAGE_OPTIONS: UseSignMessageOptions = {}

/**
 * Hook for signing messages with a confirmation modal. EIP-712 typed data is
 * available for EVM wallets; Solana wallets accept plain messages.
 *
 * Opens the Openfort "Sign message" screen, shows the message (or EIP-712 typed
 * data) to the user. Every request resolves to `{ signature }` or `{ error }`;
 * cancellation, supersession, and signing failures never reject the promise.
 *
 * @example
 * ```tsx
 * import { useSignMessage } from '@openfort/react'
 *
 * function SignButton() {
 *   const { signMessage, isPending } = useSignMessage()
 *   const sign = async () => {
 *     const result = await signMessage('I hereby vote for foobar')
 *     if ('error' in result) return
 *     console.log(result.signature)
 *   }
 *   return <button onClick={sign} disabled={isPending}>Sign</button>
 * }
 * ```
 */
export function useSignMessage(hookOptions: UseSignMessageOptions = DEFAULT_SIGN_MESSAGE_OPTIONS) {
  const { setSignRequest } = useOpenfortSignRequest()
  const { setRoute, setOpen } = useOpenfortRouting()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<OpenfortError | null>(null)
  const mountedRef = useRef(false)
  const activeRequestRef = useRef<SignRequest | null>(null)
  const hookOptionsRef = useRef(hookOptions)
  hookOptionsRef.current = hookOptions

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const request = useCallback(
    (args: SignArgs) =>
      new Promise<SignMessageResult>((resolve) => {
        activeRequestRef.current?.settle({
          error: new WalletError('Signature request was superseded by a newer request.'),
        })
        const requestHookOptions = { ...hookOptionsRef.current }
        let settled = false
        let request: SignRequest
        const settle = (result: SignMessageResult) => {
          if (settled) return
          settled = true
          if (activeRequestRef.current === request) {
            activeRequestRef.current = null
            if (mountedRef.current) {
              setIsPending(false)
              setError('error' in result ? result.error : null)
            }
          }
          if ('error' in result) {
            resolve(onError({ hookOptions: requestHookOptions, error: result.error }))
            return
          }
          resolve(onSuccess({ hookOptions: requestHookOptions, data: result }))
        }

        request = {
          ...args,
          settle,
        }
        activeRequestRef.current = request
        setError(null)
        setIsPending(true)
        // setOpen(true) resets route/history, so it MUST run before setRoute.
        setOpen(true)
        setSignRequest(request)
        setRoute(routes.SIGN_MESSAGE)
      }),
    [setSignRequest, setRoute, setOpen]
  )

  const signMessage = useCallback((message: string) => request({ kind: 'message', message }), [request])
  const signTypedData = useCallback(
    (typedData: SignTypedDataPayload) => request({ kind: 'typedData', typedData }),
    [request]
  )

  return { signMessage, signTypedData, isPending, error }
}
