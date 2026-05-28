import { CircleX, TrashIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import type { StoredData } from '@/lib/useSessionKeysStorage'

interface SessionKeyListItemProps {
  item: StoredData
  storageKey: string
  onRevoke: (publicKey: string) => Promise<{ error?: Error | null }>
  onRemove: (sessionKeyId: string) => void
  onUpdate: (key: string, data: { sessionKeyId: string; active: boolean }) => void
  onRefresh: () => void
}

export function SessionKeyListItem({
  item,
  storageKey,
  onRevoke,
  onRemove,
  onUpdate,
  onRefresh,
}: SessionKeyListItemProps) {
  const { privateKey, publicKey, sessionKeyId, active } = item

  return (
    <Tooltip key={privateKey}>
      <TooltipTrigger asChild>
        <div className="px-4 py-2 border rounded break-all flex justify-between items-center">
          <div className={cn('overflow-hidden text-muted-foreground inline-flex', !active && 'line-through')}>
            <span className="truncate font-mono">
              {publicKey.slice(0, 15)}...{publicKey.slice(-4)}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-2 text-destructive"
                onClick={async () => {
                  if (!active) {
                    onRemove(sessionKeyId)
                    setTimeout(onRefresh)
                    return
                  }
                  const { error } = await onRevoke(publicKey)
                  onUpdate(storageKey, { sessionKeyId, active: false })
                  if (!error) setTimeout(onRefresh, 100)
                }}
              >
                {active ? <CircleX size={16} /> : <TrashIcon size={16} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{active ? 'Revoke permissions' : 'Remove session key from list'}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div>Public key: {publicKey}</div>
        <div>Private key: {privateKey}</div>
        <div>Session key ID: {sessionKeyId}</div>
        <div>
          Status: <span className={active ? '' : 'text-destructive'}>{active ? 'Active' : 'PERMISSIONS REVOKED'}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

interface SessionKeyMessagesProps {
  error: Error | null | undefined
  revokeError: Error | null | undefined
  isRevoking: boolean
  signedData?: string
}

export function SessionKeyMessages({ error, revokeError, isRevoking, signedData }: SessionKeyMessagesProps) {
  return (
    <>
      {signedData && (
        <InputMessage
          message={`Signed message: ${signedData.slice(0, 10)}...${signedData.slice(-10)}`}
          show
          variant="success"
        />
      )}
      <InputMessage
        message={error?.message || 'An error occurred while granting permissions.'}
        show={!!error}
        variant="error"
      />
      <InputMessage
        message={revokeError?.message || 'An error occurred while revoking permissions.'}
        show={!!revokeError}
        variant="error"
      />
      <InputMessage message={'Revoking permissions...'} show={!!isRevoking} variant="default" />
    </>
  )
}

interface SessionKeysCreateButtonProps {
  isCreating: boolean
  disabled: boolean
  isSessionKeySupported: boolean
  isExternalWallet?: boolean
}

export function SessionKeysCreateButton({
  isCreating,
  disabled,
  isSessionKeySupported,
  isExternalWallet,
}: SessionKeysCreateButtonProps) {
  const disabledReason = isExternalWallet
    ? 'Session keys require the Openfort embedded wallet. Switch from your external wallet to use session keys.'
    : !isSessionKeySupported
      ? 'Session keys are only available for Smart Accounts. EOA wallets cannot use session keys.'
      : ''

  return (
    <>
      <Button type="submit" className="w-full" disabled={disabled}>
        {isCreating ? 'Creating...' : 'Create session key'}
      </Button>
      <InputMessage message={disabledReason} show={!!disabledReason && disabled} variant="default" />
    </>
  )
}

export function SessionKeysCardShell({ hook, children }: { hook?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session keys</CardTitle>
        <CardDescription>
          Grant session keys with specific permissions to enhance security and control over wallet actions.
        </CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
