'use client'

import { useCallback, useState } from 'react'
import { routes, type SignTypedDataPayload } from '../../components/Openfort/types'
import { useOpenfort } from '../../components/Openfort/useOpenfort'

type SignArgs = { kind: 'message'; message: string } | { kind: 'typedData'; typedData: SignTypedDataPayload }

/**
 * Hook for signing messages with a confirmation modal (EVM only).
 *
 * Opens the Openfort "Sign message" screen, shows the message (or EIP-712 typed
 * data) to the user, and resolves with the signature once they confirm. Rejects
 * if the user dismisses the modal.
 *
 * @example
 * ```tsx
 * const { signMessage, signTypedData, isPending } = useSignMessage()
 *
 * const signature = await signMessage('I hereby vote for foobar')
 *
 * const typedSignature = await signTypedData({
 *   domain: { name: 'Ether Mail', version: '1', chainId: 1, verifyingContract: '0x…' },
 *   types: { Person: [{ name: 'name', type: 'string' }] },
 *   primaryType: 'Person',
 *   message: { name: 'Cow' },
 * })
 * ```
 */
export function useSignMessage() {
  const { setSignRequest, setRoute, setOpen } = useOpenfort()
  const [isPending, setIsPending] = useState(false)

  const request = useCallback(
    (args: SignArgs) =>
      new Promise<`0x${string}`>((resolve, reject) => {
        setIsPending(true)
        // setOpen(true) resets route/history, so it MUST run before setRoute.
        setOpen(true)
        setSignRequest({
          ...args,
          resolve: (signature) => {
            setIsPending(false)
            resolve(signature)
          },
          reject: (reason) => {
            setIsPending(false)
            reject(reason)
          },
        })
        setRoute(routes.SIGN_MESSAGE)
      }),
    [setSignRequest, setRoute, setOpen]
  )

  const signMessage = useCallback((message: string) => request({ kind: 'message', message }), [request])
  const signTypedData = useCallback(
    (typedData: SignTypedDataPayload) => request({ kind: 'typedData', typedData }),
    [request]
  )

  return { signMessage, signTypedData, isPending }
}
