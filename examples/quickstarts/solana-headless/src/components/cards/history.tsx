import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { useEffect, useState } from 'react'
import { getTransactionHistory } from '../../lib/solana'
import { TruncateData } from '../ui/TruncateData'

interface TransactionHistoryItem {
  signature: string
  slot: number
  blockTime: number | null
  err: unknown | null
  memo: string | null
}

function getSolanaExplorerUrl(signature: string, cluster: string): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`
}

const COLLAPSED_COUNT = 4

export const History = () => {
  const { address, cluster, rpcUrl } = useSolanaEmbeddedWallet()
  const [transactions, setTransactions] = useState<TransactionHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const rpc = rpcUrl ?? 'https://api.devnet.solana.com'

  const fetchHistory = () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    getTransactionHistory(address, 20, rpc)
      .then(setTransactions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load history'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    fetchHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, rpc])

  const visible = showAll ? transactions : transactions.slice(0, COLLAPSED_COUNT)
  const hasMore = transactions.length > COLLAPSED_COUNT

  const formatTime = (blockTime: number | null) => {
    if (!blockTime) return '--'
    return new Date(blockTime * 1000).toLocaleString()
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1>Transaction History</h1>
          <p className="text-sm text-zinc-400">Recent transactions for your Solana wallet.</p>
        </div>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={isLoading}
          className="p-2 border border-zinc-700 rounded hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors cursor-pointer text-xs"
        >
          {isLoading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <TruncateData data={error} className="text-red-500" />}

      {isLoading ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-zinc-400">No transactions found.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((tx) => {
            const explorerUrl = cluster
              ? getSolanaExplorerUrl(tx.signature, cluster)
              : null
            const isError = tx.err != null

            return (
              <div
                key={tx.signature}
                className="flex items-center justify-between text-sm border-b border-zinc-700 pb-2 last:border-0"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-2">
                  <span className="font-mono text-xs truncate">
                    {explorerUrl ? (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {tx.signature.slice(0, 20)}...
                      </a>
                    ) : (
                      `${tx.signature.slice(0, 20)}...`
                    )}
                  </span>
                  <span className="text-xs text-zinc-400">{formatTime(tx.blockTime)}</span>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    isError
                      ? 'bg-red-900/30 text-red-400'
                      : 'bg-green-900/30 text-green-400'
                  }`}
                >
                  {isError ? 'Failed' : 'Success'}
                </span>
              </div>
            )
          })}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm text-primary hover:underline w-full text-center pt-1 cursor-pointer"
            >
              {showAll
                ? 'Show less'
                : `Show more (${transactions.length - COLLAPSED_COUNT})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
