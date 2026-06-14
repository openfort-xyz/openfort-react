'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import { useBalance } from '../../hooks/useBalance'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import type { UseEthereumBalanceOptions, UseEthereumBalanceResult } from '../types'

/**
 * Native token balance for the active embedded EVM wallet (or a given address) on the active
 * chain. Wraps the shared `useBalance` and refetches after balance-changing transactions
 * (see `invalidateBalance`). For full token + NFT inventory use `useEthereumWalletAssets`.
 *
 * @example
 * ```tsx
 * const { data } = useEthereumBalance()
 * // data?.formatted, data?.symbol
 * ```
 */
export function useEthereumBalance(options?: UseEthereumBalanceOptions): UseEthereumBalanceResult {
  const { activeEmbeddedAddress } = useOpenfortCore()
  const strategy = useConnectionStrategy()
  const address = options?.address ?? activeEmbeddedAddress ?? ''
  const chainId = options?.chainId ?? strategy?.getChainId()

  const balance = useBalance({
    address,
    chainType: ChainTypeEnum.EVM,
    ...(chainId != null && { chainId }),
    enabled: options?.enabled ?? address.length > 0,
    ...(options?.refetchInterval != null && { refetchInterval: options.refetchInterval }),
  })

  return {
    data:
      balance.status === 'success'
        ? { value: balance.value, formatted: balance.formatted, symbol: balance.symbol, decimals: balance.decimals }
        : undefined,
    isIdle: balance.status === 'idle',
    isLoading: balance.status === 'loading',
    isSuccess: balance.status === 'success',
    isError: balance.status === 'error',
    error:
      balance.status === 'error'
        ? balance.error instanceof OpenfortError
          ? balance.error
          : new OpenfortError(balance.error.message, OpenfortReactErrorType.UNEXPECTED_ERROR, { error: balance.error })
        : undefined,
    refetch: balance.refetch,
  }
}
