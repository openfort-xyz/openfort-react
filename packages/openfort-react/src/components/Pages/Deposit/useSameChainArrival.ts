'use client'

import { useEffect, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { invalidateBalance } from '../../../hooks/useBalance.js'
import { getDefaultEthereumRpcUrl } from '../../../utils/rpc.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'

/**
 * Backoff schedule (ms) for the waiting poll: brisk at first, easing off so a
 * long wait doesn't hammer the RPC. The last entry is the steady-state cap.
 */
const POLL_BACKOFF_MS = [2_000, 2_000, 3_000, 5_000, 8_000, 12_000, 20_000] as const

/**
 * Watches a wallet's native balance and reports when it increases past the first
 * observed value — i.e. a same-chain deposit landed. Same-chain "transfer from
 * address" has no rail session to poll (the deposit address is the wallet
 * itself), so arrival is read straight from the chain RPC.
 *
 * Self-contained single timeout chain (no shared query cache), so it can't fan
 * out into a request storm: one read in flight at a time, with an interval that
 * grows on each tick and resets to brisk when the user returns to the tab (the
 * moment a deposit was likely just made). On arrival, cached balances are
 * invalidated so the asset list refreshes, and polling stops.
 */
export function useSameChainArrival({
  address,
  chainId,
  enabled,
}: {
  address: string
  chainId: number
  enabled: boolean
}): { arrived: boolean } {
  const { walletConfig } = useOpenfort()
  const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId)

  const [arrived, setArrived] = useState(false)
  const baselineRef = useRef<bigint | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `chainId` is a restart trigger — the poll below reads balances for the chain whose RPC URL was derived from it, so a chain switch has to start a fresh poll from a new baseline
  useEffect(() => {
    if (!enabled || !address) return

    const client = createPublicClient({ transport: http(rpcUrl) })
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let step = 0
    baselineRef.current = null

    const read = async () => {
      try {
        const balance = await client.getBalance({ address: address as `0x${string}` })
        if (cancelled) return
        if (baselineRef.current === null) {
          baselineRef.current = balance
        } else if (balance > baselineRef.current) {
          setArrived(true)
          invalidateBalance()
          return // deposit landed — stop polling
        }
      } catch {
        // transient RPC error — keep polling on the same schedule
      }
      if (cancelled) return
      const delay = POLL_BACKOFF_MS[Math.min(step, POLL_BACKOFF_MS.length - 1)]
      step += 1
      timer = setTimeout(read, delay)
    }

    // Re-check immediately when the user returns to the tab (deposit likely just
    // made), and reset the schedule back to brisk.
    const onReturn = () => {
      if (cancelled || document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      step = 0
      read()
    }

    read()
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [enabled, address, chainId, rpcUrl])

  return { arrived }
}
