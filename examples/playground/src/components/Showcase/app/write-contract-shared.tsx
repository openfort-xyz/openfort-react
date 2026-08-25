import { ChainTypeEnum } from '@openfort/react'
import { formatUnits } from 'viem'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { MintContractConfig } from '@/lib/contracts'
import { getExplorerUrl } from '@/lib/explorer'

interface WriteContractLayoutProps {
  hook?: string
  /** Render only the body — the surrounding card chrome comes from ActionCard. */
  bare?: boolean
  config: MintContractConfig | undefined
  address: `0x${string}` | undefined
  chainId: number | undefined
  balance: bigint | undefined
  balanceError: Error | null | undefined
  hash: `0x${string}` | undefined
  isPending: boolean
  error: Error | null | undefined
  onSubmit: (amount: string) => void
  disabledReason?: string
  /** Non-blocking notice shown above the button — informs without disabling the action. */
  warning?: string
}

export function WriteContractLayout({
  hook,
  bare,
  config,
  address,
  chainId,
  balance,
  balanceError,
  hash,
  isPending,
  error,
  onSubmit,
  disabledReason,
  warning,
}: WriteContractLayoutProps) {
  const isDisabled = isPending || !address || !config || !!disabledReason
  const body = (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        const amount = (e.target as HTMLFormElement).amount.value || '1'
        onSubmit(amount)
      }}
    >
      <Input type="number" placeholder="Enter amount to mint" name="amount" />
      <Button type="submit" className="w-full" disabled={isDisabled}>
        {isPending ? 'Minting...' : 'Mint Tokens'}
      </Button>
      <InputMessage message={disabledReason ?? ''} show={!!disabledReason} variant="default" />
      <InputMessage message={warning ?? ''} show={!!warning} variant="warning" />
      <InputMessage message={`Transaction hash: ${hash}`} show={!!hash} variant="success" />
      {hash && chainId && (
        <a
          href={getExplorerUrl(ChainTypeEnum.EVM, { chainId, txHash: hash })}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-blue-400"
        >
          View on Explorer
        </a>
      )}
      <InputMessage message={error ? `Error: ${error.message}` : ''} show={!!error} variant="error" />
    </form>
  )

  if (bare) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Contract <TruncatedText text={config?.address ?? ''} /> · balance{' '}
          {balanceError ? '-' : formatUnits(balance ?? 0n, 18) || 0}
        </p>
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write Contract</CardTitle>
        <CardDescription>Interact with smart contracts on the blockchain.</CardDescription>
        <CardDescription>
          Contract Address: <TruncatedText text={config?.address ?? ''} />
        </CardDescription>
        <CardDescription>Balance: {balanceError ? '-' : formatUnits(balance ?? 0n, 18) || 0}</CardDescription>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
