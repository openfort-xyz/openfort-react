import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useSolanaMessageSigner } from '@/hooks/useSolanaMessageSigner'

export const SignaturesCardSolana = ({ hook }: { hook?: string }) => {
  const { data, signMessage, isPending, error } = useSolanaMessageSigner()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signatures</CardTitle>
        <CardDescription>Sign messages with your Solana wallet (Ed25519). Signature is base58.</CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const message = (e.target as HTMLFormElement).message.value
            signMessage({ message })
          }}
        >
          <Input name="message" type="text" placeholder="Enter a message to sign" defaultValue="Hello from Openfort!" />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing...' : 'Sign a message'}
          </Button>
          <InputMessage
            message={data ? `Signature: ${data.slice(0, 12)}...${data.slice(-8)}` : ''}
            show={!!data}
            variant="success"
          />
          <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
        </form>
      </CardContent>
    </Card>
  )
}
