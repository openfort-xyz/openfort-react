import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface SignaturesLayoutProps {
  hook?: string
  /** Render only the body — the surrounding card chrome comes from ActionCard. */
  bare?: boolean
  isPending: boolean
  canSign: boolean
  signature: string | undefined
  error: Error | null | undefined
  onSubmit: (message: string) => void
}

export function SignaturesLayout({
  hook,
  bare,
  isPending,
  canSign,
  signature,
  error,
  onSubmit,
}: SignaturesLayoutProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const message = (e.currentTarget.message.value as string) || ''
    onSubmit(message)
  }

  const body = (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <Input
        name="message"
        type="text"
        placeholder="Enter a message to sign"
        defaultValue="Hello from Openfort!"
        disabled={isPending || !canSign}
      />
      <Button type="submit" className="w-full" disabled={isPending || !canSign}>
        {isPending ? 'Signing...' : 'Sign a message'}
      </Button>
      <InputMessage
        message={`Signed message: ${signature?.slice(0, 10)}...${signature?.slice(-10)}`}
        show={!!signature}
        variant="success"
      />
      <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
    </form>
  )

  if (bare) return body

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signatures</CardTitle>
        <CardDescription>
          Sign messages with your wallet to prove ownership and perform actions in the app.
        </CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
