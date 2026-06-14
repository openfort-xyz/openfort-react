'use client'

import { useCallback, useMemo, useState } from 'react'
import { numberToHex } from 'viem'
import { useOpenfortUIContext } from '../../components/Openfort/useOpenfort'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import { resolveEthereumFeeSponsorship } from '../../core/strategyUtils'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { createOpenfortError, type OpenfortHookOptions } from '../../types'

/** Internal EVM transaction shape shared by useSendTransaction and useWriteContract. */
type EvmTx = {
  to: `0x${string}`
  value?: bigint
  data?: `0x${string}`
  chainId?: number
}

type SendStatus = 'idle' | 'loading' | 'success' | 'error'

type EvmSendCore = {
  data: `0x${string}` | undefined
  status: SendStatus
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: OpenfortError | undefined
  isSponsored: boolean
  reset: () => void
  run: (tx: EvmTx) => Promise<`0x${string}` | undefined>
  runAsync: (tx: EvmTx) => Promise<`0x${string}`>
}

/**
 * Shared core for EVM transaction hooks. Acquires the embedded EIP-1193 provider configured
 * with the resolved fee-sponsorship policy and sends an `eth_sendTransaction`, with no wagmi
 * dependency. `runAsync` throws on failure; `run` resolves to `undefined` and surfaces the
 * error via state and the `onError` callback.
 */
export function useEvmSend(options?: OpenfortHookOptions<{ hash: `0x${string}` }>): EvmSendCore {
  const { client, activeEmbeddedAddress } = useOpenfortCore()
  const { walletConfig } = useOpenfortUIContext()
  const strategy = useConnectionStrategy()
  const defaultChainId = strategy?.getChainId()

  const [state, setState] = useState<{ status: SendStatus; data?: `0x${string}`; error?: OpenfortError }>({
    status: 'idle',
  })

  const isSponsored = useMemo(
    () => defaultChainId != null && resolveEthereumFeeSponsorship(walletConfig, defaultChainId) != null,
    [walletConfig, defaultChainId]
  )

  const runAsync = useCallback(
    async (tx: EvmTx): Promise<`0x${string}`> => {
      setState({ status: 'loading' })
      try {
        if (!activeEmbeddedAddress) throw createOpenfortError('PROVIDER_NOT_READY')
        const chainId = tx.chainId ?? defaultChainId
        if (chainId == null) {
          throw new OpenfortError(
            'No chain configured for the embedded wallet.',
            OpenfortReactErrorType.CONFIGURATION_ERROR,
            undefined,
            { suggestion: 'Set walletConfig.ethereum.chainId or pass chainId to the transaction.' }
          )
        }
        // Resolve sponsorship and rpc here so the provider is configured regardless of init order.
        const feeSponsorship = resolveEthereumFeeSponsorship(walletConfig, chainId)
        const chains = walletConfig?.ethereum?.rpcUrls ?? {}
        const provider = await client.embeddedWallet.getEthereumProvider({ ...feeSponsorship, chains })
        await provider.request({ method: 'eth_requestAccounts' })
        const hash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: activeEmbeddedAddress,
              to: tx.to,
              ...(tx.value != null && { value: numberToHex(tx.value) }),
              ...(tx.data && { data: tx.data }),
            },
          ],
        })) as `0x${string}`
        setState({ status: 'success', data: hash })
        options?.onSuccess?.({ hash })
        return hash
      } catch (err) {
        const error =
          err instanceof OpenfortError
            ? err
            : new OpenfortError('Failed to send transaction', OpenfortReactErrorType.WALLET_ERROR, { error: err })
        setState({ status: 'error', error })
        options?.onError?.(error)
        throw error
      }
    },
    [client, walletConfig, activeEmbeddedAddress, defaultChainId, options]
  )

  const run = useCallback(
    async (tx: EvmTx): Promise<`0x${string}` | undefined> => {
      try {
        return await runAsync(tx)
      } catch {
        return undefined
      }
    },
    [runAsync]
  )

  const reset = useCallback(() => setState({ status: 'idle' }), [])

  return {
    data: state.data,
    status: state.status,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    error: state.error,
    isSponsored,
    reset,
    run,
    runAsync,
  }
}
