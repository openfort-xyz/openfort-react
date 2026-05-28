import { useUI } from '@openfort/react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'

export const Route = createFileRoute('/_showcase/showcase/auth/')({
  component: RouteComponent,
})

function RouteComponent() {
  const ui = useUI()

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
          <Logo className="h-10" />
          <div className="space-y-1">
            <h1 className="text-lg font-medium">Connect to start</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with the Openfort widget — email, social, guest, or an external wallet.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => ui.open()}>
            Connect Wallet
            <ArrowRight className="size-4" />
          </Button>
          <p className="font-mono text-xs text-muted-foreground">{'<OpenfortButton /> · useUI().open()'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
