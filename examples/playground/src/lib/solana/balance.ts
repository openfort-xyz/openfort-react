const DEFAULT_RPC = 'https://api.devnet.solana.com'

export async function fetchSolanaBalance(rpcUrl: string | undefined, address: string): Promise<number> {
  const rpc = rpcUrl ?? DEFAULT_RPC
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address, { commitment: 'confirmed' }],
    }),
  })
  const data = await res.json()
  return data.result?.value ?? 0
}
