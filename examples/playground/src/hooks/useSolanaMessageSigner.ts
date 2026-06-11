/**
 * Playground-only: sign messages with Openfort Solana embedded wallet.
 * Returns { data, signMessage, isPending, error }. Not part of SDK.
 */

import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { useCallback, useState } from 'react'
import { toError } from '@/lib/errors'

export function useSolanaMessageSigner() {
  const solana = useSolanaEmbeddedWallet()
  const [data, setData] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isPending, setIsPending] = useState(false)

  const signMessage = useCallback(
    async (params: { message: string }) => {
      if (solana.status !== 'connected') {
        setError(new Error('Wallet not connected'))
        return
      }
      setError(null)
      setIsPending(true)
      try {
        const signature = await solana.provider.signMessage(params.message)
        setData(signature)
      } catch (err) {
        setError(toError(err))
      } finally {
        setIsPending(false)
      }
    },
    [solana.status, solana.provider]
  )

  return { data: data ?? undefined, signMessage, isPending, error: error ?? null }
}
