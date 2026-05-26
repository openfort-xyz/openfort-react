import { ChainTypeEnum, invalidateBalance } from '@openfort/react'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import type { Address } from '@solana/kit'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAsyncData } from '@/hooks/useAsyncData'
import { getExplorerUrl } from '@/lib/explorer'
import { fetchSolanaBalance, sendGaslessSolTransaction, sendSolTransaction } from '@/lib/solana'

export const SendTransactionCardSolana = ({ hook }: { hook?: string }) => {
  const solana = useSolanaEmbeddedWallet()
  const { address, cluster, rpcUrl } = solana
  const [isPending, setIsPending] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const rpc = rpcUrl ?? 'https://api.devnet.solana.com'

  const balanceResult = useAsyncData({
    queryKey: ['solana-balance', address, rpc],
    queryFn: () => (address ? fetchSolanaBalance(rpc, address) : Promise.resolve(0)),
    enabled: Boolean(address),
  })

  const balanceSol = balanceResult.data != null ? balanceResult.data / 1e9 : null
  const balanceFormatted =
    balanceSol != null ? (balanceSol < 0.001 ? balanceSol.toExponential(2) : balanceSol.toFixed(4)) : null

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSend = async (gasless: boolean) => {
    if (solana.status !== 'connected' || !address) return
    const form = document.getElementById('send-sol-form') as HTMLFormElement
    const recipient = form.recipient?.value?.trim()
    const amountStr = form.amount?.value
    if (!recipient || !amountStr) return
    const amountInSol = Number.parseFloat(amountStr)
    if (!Number.isFinite(amountInSol) || amountInSol <= 0) return

    setIsPending(true)
    setError(null)
    setTxSignature(null)

    try {
      const provider = solana.provider
      if (gasless) {
        const projectKey = import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY
        if (!projectKey) {
          setError('VITE_OPENFORT_PUBLISHABLE_KEY is not set')
          return
        }
        const { signature } = await sendGaslessSolTransaction({
          from: address as Address,
          to: recipient as Address,
          amountInSol,
          provider,
          koraConfig: {
            rpcUrl: 'https://api.openfort.io/rpc/solana/devnet',
            apiKey: `Bearer ${projectKey}`,
          },
        })
        setTxSignature(signature)
      } else {
        const { signature } = await sendSolTransaction({
          from: address as Address,
          to: recipient as Address,
          amountInSol,
          provider,
          rpcUrl: rpc,
        })
        setTxSignature(signature)
      }
      invalidateBalance()
      balanceResult.refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setIsPending(false)
    }
  }

  const explorerUrl = txSignature
    ? getExplorerUrl(ChainTypeEnum.SVM, { txHash: txSignature, cluster: cluster ?? 'devnet' })
    : null

  const isConnected = solana.status === 'connected'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send SOL</CardTitle>
        <CardDescription>
          Transfer SOL to another address. Supports regular and gasless (Kora) transfers.
        </CardDescription>
        {address && (
          <CardDescription className="flex flex-col gap-0.5">
            <span className="flex items-center gap-x-1.5">
              Address: <TruncatedText text={address} />
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="inline-flex size-6 items-center justify-center rounded hover:bg-muted transition-colors"
                    aria-label="Copy address"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="size-3.5 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {copied ? 'Copied' : 'Copy address'}
                </TooltipContent>
              </Tooltip>
            </span>
            <span className="text-muted-foreground">
              Balance: {balanceResult.isLoading ? '...' : balanceFormatted != null ? `${balanceFormatted} SOL` : '--'}
            </span>
          </CardDescription>
        )}
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>
        <form id="send-sol-form" className="space-y-2" onSubmit={(e) => e.preventDefault()}>
          <Input type="text" placeholder="Recipient address" name="recipient" />
          <Input type="number" placeholder="Amount (SOL)" name="amount" step="0.001" min="0.001" defaultValue="0.001" />
          <div className="flex gap-2">
            <Button className="flex-1" disabled={isPending || !isConnected} onClick={() => handleSend(false)}>
              {isPending ? 'Sending...' : 'Send SOL'}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={isPending || !isConnected}
              onClick={() => handleSend(true)}
            >
              {isPending ? 'Sending...' : 'Gasless'}
            </Button>
          </div>
          <InputMessage
            message={txSignature ? `Tx: ${txSignature.slice(0, 12)}...` : ''}
            show={!!txSignature}
            variant="success"
          />
          {explorerUrl && txSignature && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              View on Explorer
            </a>
          )}
          <InputMessage message={error ?? ''} show={!!error} variant="error" />
        </form>
      </CardContent>
    </Card>
  )
}
