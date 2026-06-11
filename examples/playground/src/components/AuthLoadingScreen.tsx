import { Loader2 } from 'lucide-react'

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Restoring session…</p>
    </div>
  )
}
