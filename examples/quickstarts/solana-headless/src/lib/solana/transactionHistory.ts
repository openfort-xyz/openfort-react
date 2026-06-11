interface TransactionHistoryItem {
  signature: string
  slot: number
  blockTime: number | null
  err: unknown | null
  memo: string | null
}

const DEFAULT_RPC = 'https://api.devnet.solana.com'

/**
 * Fetches tx history via raw JSON-RPC (avoids @solana/kit transport issues in browser).
 */
export async function getTransactionHistory(
  address: string,
  limit = 10,
  rpcUrl?: string
): Promise<TransactionHistoryItem[]> {
  const rpc = rpcUrl ?? DEFAULT_RPC
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [address, { limit, commitment: 'confirmed' }],
    }),
  })
  const data = await res.json()
  if (!data.result) return []
  return data.result.map((sig: Record<string, unknown>) => ({
    signature: sig.signature as string,
    slot: sig.slot as number,
    blockTime: (sig.blockTime as number) ?? null,
    err: sig.err ?? null,
    memo: (sig.memo as string) ?? null,
  }))
}
