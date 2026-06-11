import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import type { Address } from '@solana/kit'
import { useEffect, useState } from 'react'
import { fetchSolanaBalance, sendGaslessSolTransaction, sendSolTransaction } from '../../lib/solana'
import { TruncateData } from '../ui/TruncateData'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function getSolanaExplorerUrl(signature: string, cluster: string): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`
}

export const Send = () => {
  const solana = useSolanaEmbeddedWallet()
  const { address, cluster, rpcUrl } = solana
  const [isPending, setIsPending] = useState(false)
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  const rpc = rpcUrl ?? 'https://api.devnet.solana.com'

  useEffect(() => {
    if (!address) return
    setIsLoadingBalance(true)
    fetchSolanaBalance(rpc, address)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setIsLoadingBalance(false))
  }, [address, rpc])

  const balanceSol = balance != null ? balance / 1e9 : null
  const balanceFormatted =
    balanceSol != null
      ? balanceSol < 0.001
        ? balanceSol.toExponential(2)
        : balanceSol.toFixed(4)
      : null

  const handleSend = async (gasless: boolean) => {
    if (solana.status !== 'connected' || !address) return
    const form = document.getElementById('send-sol-form') as HTMLFormElement
    const recipient = (form.elements.namedItem('recipient') as HTMLInputElement)?.value?.trim()
    const amountStr = (form.elements.namedItem('amount') as HTMLInputElement)?.value
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
      // Refresh balance after transaction
      if (address) {
        fetchSolanaBalance(rpc, address).then(setBalance).catch(() => null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setIsPending(false)
    }
  }

  const explorerUrl =
    txSignature && cluster
      ? getSolanaExplorerUrl(txSignature, cluster)
      : null

  const isConnected = solana.status === 'connected'
  const otherWallets = solana.wallets.filter((w) => w.address !== address)

  return (
    <div className="flex flex-col w-full">
      <h1>Send SOL</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Transfer SOL to another address. Supports regular and gasless (Kora) transfers.
      </p>

      {address && (
        <div className="mb-4 p-3 border border-zinc-700 rounded bg-zinc-900 text-sm space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400">
              Address:{' '}
              <span className="font-mono text-zinc-200">
                {address.slice(0, 8)}...{address.slice(-6)}
              </span>
            </p>
            <CopyButton text={address} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-zinc-400">
              Balance:{' '}
              <span className="text-zinc-200">
                {isLoadingBalance ? '...' : balanceFormatted != null ? `${balanceFormatted} SOL` : '--'}
              </span>
            </p>
            {cluster !== 'mainnet-beta' && (
              <a
                href="https://faucet.solana.com/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline shrink-0"
              >
                Airdrop ↗
              </a>
            )}
          </div>
        </div>
      )}

      {otherWallets.length > 0 && (
        <div className="mb-4 p-3 border border-zinc-700 rounded bg-zinc-900 text-sm space-y-1">
          <p className="text-zinc-500 text-xs mb-2">Other wallets — Fill to set as recipient</p>
          {otherWallets.map((w) => (
            <div key={w.address} className="flex items-center justify-between gap-2">
              <span className="font-mono text-zinc-300 text-xs truncate">
                {w.address.slice(0, 10)}...{w.address.slice(-6)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const form = document.getElementById('send-sol-form') as HTMLFormElement
                  const input = form?.elements.namedItem('recipient') as HTMLInputElement
                  if (input) input.value = w.address
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
              >
                Fill
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        id="send-sol-form"
        className="space-y-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="text"
          name="recipient"
          placeholder="Recipient address"
        />
        <input
          type="number"
          name="amount"
          placeholder="Amount (SOL)"
          step="0.001"
          min="0.001"
          defaultValue="0.001"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn flex-1"
            disabled={isPending || !isConnected}
            onClick={() => handleSend(false)}
          >
            {isPending ? 'Sending...' : 'Send SOL'}
          </button>
          <button
            type="button"
            className="btn flex-1 bg-zinc-700 hover:bg-zinc-600"
            disabled={isPending || !isConnected}
            onClick={() => handleSend(true)}
          >
            {isPending ? 'Sending...' : 'Gasless (Kora)'}
          </button>
        </div>
      </form>

      {txSignature && (
        <div className="mt-4 space-y-2">
          <p className="text-green-400 text-sm">Transaction sent!</p>
          <TruncateData data={txSignature} />
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View on Solana Explorer
            </a>
          )}
        </div>
      )}

      {error && (
        <TruncateData data={error} className="text-red-500" />
      )}
    </div>
  )
}
