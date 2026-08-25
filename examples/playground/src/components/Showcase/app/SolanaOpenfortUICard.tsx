import { useSignMessage as useOpenfortSignMessage, useUI } from '@openfort/react'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { useState } from 'react'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Solana showcase of the SDK's prebuilt modal UI: the sign-message confirmation
 * screen (now chain-aware — signs via the Solana embedded wallet) plus the
 * Send/Receive wallet flows, all via the SDK instead of headless calls.
 */
export const SolanaOpenfortUICard = ({ hook }: { hook?: string }) => {
  const { signMessage, isPending } = useOpenfortSignMessage()
  const ui = useUI()
  const solana = useSolanaEmbeddedWallet()
  const canSign = solana.status === 'connected'
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const handleSign = async () => {
    setError(null)
    setSignature(null)
    const result = await signMessage('Hello from Openfort!')
    if ('error' in result) setError(result.error)
    else setSignature(result.signature)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Openfort UI</CardTitle>
        <CardDescription>
          Prebuilt modal screens — sign, send, receive, add funds — instead of headless calls.
        </CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={isPending || !canSign} onClick={handleSign}>
            {isPending ? 'Waiting…' : 'Sign message'}
          </Button>
          <Button variant="outline" onClick={() => ui.openSend()}>
            Send
          </Button>
          <Button variant="outline" onClick={() => ui.openReceive()}>
            Receive
          </Button>
          <Button variant="outline" onClick={() => ui.openFunding()}>
            Add funds (hub)
          </Button>
          <Button variant="outline" onClick={() => ui.openBuy()}>
            Buy with fiat
          </Button>
        </div>
        <InputMessage
          message={signature ? `Signed: ${signature.slice(0, 10)}…${signature.slice(-8)}` : ''}
          show={!!signature}
          variant="success"
        />
        <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
      </CardContent>
    </Card>
  )
}
