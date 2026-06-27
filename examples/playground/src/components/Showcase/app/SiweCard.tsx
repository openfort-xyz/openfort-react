import { createSIWEMessage, useSignMessage as useOpenfortSignMessage } from '@openfort/react'
import { useState } from 'react'
import { recoverMessageAddress } from 'viem'
import { generateSiweNonce } from 'viem/siwe'
import { useChainId } from 'wagmi'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'
import { toError } from '@/lib/errors'

/**
 * Sign-In with Ethereum (EIP-4361): build a SIWE message, sign it through the
 * Openfort widget, then recover the signer to prove ownership — the real-world
 * use case for message signing.
 */
export const SiweCard = ({ hook }: { hook?: string }) => {
  const { signMessage, isPending } = useOpenfortSignMessage()
  const address = useDisplayEthereumAddress()
  const chainId = useChainId()
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const handleSignIn = async () => {
    setError(null)
    setResult(null)
    if (!address) {
      setError(new Error('Wallet not connected'))
      return
    }
    try {
      const message = createSIWEMessage(address, generateSiweNonce(), chainId)
      if (!message) throw new Error('Could not build the SIWE message')
      const signature = await signMessage(message)
      // EOA verification via signer recovery. Smart accounts sign via EIP-1271
      // (recovery won't match) — that's verified server-side, so don't fail here.
      let verified = false
      try {
        const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` })
        verified = recovered.toLowerCase() === address.toLowerCase()
      } catch {
        // ignore — non-EOA signature
      }
      setResult(`Signed in as ${address.slice(0, 6)}…${address.slice(-4)}${verified ? ' · verified' : ''}`)
    } catch (err) {
      setError(toError(err))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-In with Ethereum</CardTitle>
        <CardDescription>Build a SIWE (EIP-4361) message, sign it in the widget, and verify ownership.</CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full" disabled={isPending || !address} onClick={handleSignIn}>
          {isPending ? 'Waiting…' : 'Sign in with Ethereum'}
        </Button>
        <InputMessage message={result ?? ''} show={!!result} variant="success" />
        <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
      </CardContent>
    </Card>
  )
}
