'use client'

import { useCallback } from 'react'
import { encodeFunctionData } from 'viem'
import type { UseSendTransactionOptions, UseWriteContractResult, WriteContractParams } from '../types'
import { useEvmSend } from './useEvmSend'

function encodeWrite(params: WriteContractParams): `0x${string}` {
  return encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args ?? [],
  } as Parameters<typeof encodeFunctionData>[0])
}

/**
 * Write to a contract from the embedded wallet — no wagmi required. Encodes calldata with viem
 * and sends it through the embedded provider. Gas is sponsored when configured (see `isSponsored`).
 *
 * @example
 * ```tsx
 * const { writeContract } = useWriteContract()
 * writeContract({ address: '0x…', abi, functionName: 'mint', args: [to, 1n] })
 * ```
 */
export function useWriteContract(options?: UseSendTransactionOptions): UseWriteContractResult {
  const { run, runAsync, data, status, isIdle, isLoading, isSuccess, isError, error, isSponsored, reset } =
    useEvmSend(options)

  const writeContract = useCallback(
    (params: WriteContractParams) =>
      run({ to: params.address, data: encodeWrite(params), value: params.value, chainId: params.chainId }),
    [run]
  )
  const writeContractAsync = useCallback(
    (params: WriteContractParams) =>
      runAsync({ to: params.address, data: encodeWrite(params), value: params.value, chainId: params.chainId }),
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
    writeContract,
    writeContractAsync,
  }
}
