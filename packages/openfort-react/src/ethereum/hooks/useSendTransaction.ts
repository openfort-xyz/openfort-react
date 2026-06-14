'use client'

import { useCallback } from 'react'
import type { SendTransactionParams, SendTransactionResult, UseSendTransactionOptions } from '../types'
import { useEvmSend } from './useEvmSend'

/**
 * Send a native EVM transaction from the embedded wallet — no wagmi required.
 *
 * Gas is sponsored automatically when `walletConfig.ethereum.ethereumFeeSponsorshipId` is set
 * for the active chain; `isSponsored` reflects whether a policy resolved.
 *
 * @example
 * ```tsx
 * const { sendTransaction, isSponsored, data: hash, isLoading } = useSendTransaction()
 * sendTransaction({ to: '0x…', value: parseEther('0.01') })
 * ```
 */
export function useSendTransaction(options?: UseSendTransactionOptions): SendTransactionResult {
  const { run, runAsync, data, status, isIdle, isLoading, isSuccess, isError, error, isSponsored, reset } =
    useEvmSend(options)

  const sendTransaction = useCallback(
    (params: SendTransactionParams) =>
      run({ to: params.to, value: params.value, data: params.data, chainId: params.chainId }),
    [run]
  )
  const sendTransactionAsync = useCallback(
    (params: SendTransactionParams) =>
      runAsync({ to: params.to, value: params.value, data: params.data, chainId: params.chainId }),
    [runAsync]
  )

  return {
    data,
    status,
    isIdle,
    isLoading,
    isSuccess,
    isError,
    error,
    isSponsored,
    reset,
    sendTransaction,
    sendTransactionAsync,
  }
}
