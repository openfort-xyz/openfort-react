'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { openfortKeys } from '../../query/queryKeys.js'
import { type UseQueryReturnType, useQuery } from '../../query/useQuery.js'
import { useSolanaContext } from '../SolanaContext.js'
import { useSolanaEmbeddedWallet } from './useSolanaEmbeddedWallet.js'

/** A holding in the connected Solana wallet: native SOL or an SPL token. */
type SolanaAsset = {
  /** Mint address, or 'native' for SOL. */
  mint: string
  symbol: string
  name: string
  /** Raw balance in base units (lamports for SOL, token base units otherwise). */
  amount: bigint
  decimals: number
  isNative: boolean
}

/** SPL Token + Token-2022 program ids — token accounts live under one of these. */
const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']

/**
 * Known SPL mints → display metadata. An SPL token account carries only the mint
 * and amount on-chain (no symbol/name), so common mints are mapped here; unknown
 * mints fall back to a truncated mint address.
 */
const KNOWN_MINTS: Record<string, { symbol: string; name: string }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', name: 'USD Coin' },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', name: 'Tether USD' },
  // Circle's devnet USDC mint (same UI label).
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': { symbol: 'USDC', name: 'USD Coin' },
}

async function fetchSolanaAssets(addressStr: string, rpcUrl: string): Promise<SolanaAsset[]> {
  const { address, createSolanaRpc } = await import('@solana/kit')
  const rpc = createSolanaRpc(rpcUrl)
  const owner = address(addressStr)
  const out: SolanaAsset[] = []

  // Native SOL — always listed (even at zero) so it anchors the view.
  const { value: lamports } = await rpc.getBalance(owner, { commitment: 'confirmed' }).send()
  out.push({ mint: 'native', symbol: 'SOL', name: 'Solana', amount: BigInt(lamports), decimals: 9, isNative: true })

  // SPL token balances across both token programs. The jsonParsed encoding yields
  // a typed account whose `data.parsed.info` carries the mint and token amount.
  for (const program of TOKEN_PROGRAMS) {
    try {
      const { value: accounts } = await rpc
        .getTokenAccountsByOwner(
          owner,
          { programId: address(program) },
          { encoding: 'jsonParsed', commitment: 'confirmed' }
        )
        .send()
      for (const acc of accounts) {
        const info = acc.account.data.parsed.info
        const amount = BigInt(info.tokenAmount.amount)
        if (amount === BigInt(0)) continue
        const mint = info.mint as string
        const known = KNOWN_MINTS[mint]
        out.push({
          mint,
          symbol: known?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
          name: known?.name ?? 'SPL Token',
          amount,
          decimals: info.tokenAmount.decimals,
          isNative: false,
        })
      }
    } catch {
      // Program absent or RPC hiccup — skip this program, keep what we have.
    }
  }
  return out
}

/**
 * The TanStack query result, mirroring `useEthereumWalletAssets` from
 * `@openfort/react/ethereum`: `data`
 * is `null` rather than `undefined` before the first result, and `isIdle`
 * reports that the query is gated off because no wallet or cluster is available.
 */
type UseSolanaWalletAssetsResult = Omit<UseQueryReturnType<SolanaAsset[], Error>, 'data'> & {
  data: SolanaAsset[] | null
  isIdle: boolean
}

/**
 * Returns the connected Solana wallet's balances: native SOL plus SPL token
 * holdings, read directly from the cluster RPC. The SVM counterpart of
 * `useEthereumWalletAssets` from `@openfort/react/ethereum`, feeding the
 * Solana asset inventory.
 *
 * The result refreshes when balances are invalidated — see `useInvalidateBalance`.
 */
export function useSolanaWalletAssets(): UseSolanaWalletAssetsResult {
  const wallet = useSolanaEmbeddedWallet()
  const { rpcUrl } = useSolanaContext()
  const address = wallet.status === 'connected' && wallet.address ? wallet.address : undefined
  const enabled = Boolean(address && rpcUrl)

  const { data, ...query } = useQuery({
    queryKey: openfortKeys.walletAssets({
      address: address ?? '',
      chainType: ChainTypeEnum.SVM,
      multiChain: false,
      rpcUrl,
    }),
    queryFn: () => (address && rpcUrl ? fetchSolanaAssets(address, rpcUrl) : Promise.resolve([])),
    enabled,
    staleTime: 30_000,
  })

  return { ...query, data: data ?? null, isIdle: !enabled }
}
