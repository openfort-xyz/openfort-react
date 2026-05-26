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
}

export function WriteContractLayout({
  hook,
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
}: WriteContractLayoutProps) {
  const isDisabled = isPending || !address || !config || !!disabledReason
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
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
