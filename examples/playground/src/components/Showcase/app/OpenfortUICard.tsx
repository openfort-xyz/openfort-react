import type { SignMessageResult, SignTypedDataPayload } from '@openfort/react'
import { useSignMessage as useOpenfortSignMessage, useUI } from '@openfort/react'
import { useState } from 'react'
import { useChainId } from 'wagmi'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'

/** EIP-712 sample for the typed-data sign screen. The domain chainId must match the
 * active chain or the embedded wallet rejects it ("Invalid chainId"), so it's filled
 * in at call time from the live chain. */
const sampleTypedData = (chainId: number): SignTypedDataPayload => ({
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
    contents: 'Hello, Bob! This is a longer typed-data payload so the sign screen has to scroll on mobile.',
  },
})

/**
 * Showcases the SDK's prebuilt modal UI instead of headless calls: the sign-message
 * / typed-data confirmation screen and the Send/Receive wallet flows.
 */
export const OpenfortUICard = ({ hook }: { hook?: string }) => {
  const { signMessage, signTypedData, isPending } = useOpenfortSignMessage()
  const ui = useUI()
  const address = useDisplayEthereumAddress()
  const chainId = useChainId()
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const run = async (fn: () => Promise<SignMessageResult>) => {
    setError(null)
    setSignature(null)
    const result = await fn()
    if ('error' in result) setError(result.error)
    else setSignature(result.signature)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Openfort UI</CardTitle>
        <CardDescription>
          Prebuilt modal screens — sign, send, receive, export key — instead of headless calls.
        </CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={isPending || !address}
            onClick={() => run(() => signMessage('Hello from Openfort!'))}
          >
            {isPending ? 'Waiting…' : 'Sign message'}
          </Button>
          <Button
            variant="outline"
            disabled={isPending || !address}
            onClick={() => run(() => signTypedData(sampleTypedData(chainId)))}
          >
            Sign typed data
          </Button>
          <Button variant="outline" onClick={() => ui.openSend()}>
            Send
          </Button>
          <Button variant="outline" onClick={() => ui.openReceive()}>
            Receive
          </Button>
          <Button variant="outline" onClick={() => ui.openExportKey()}>
            Export key
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
