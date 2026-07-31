'use client'

import type { RevokePermissionsRequestParams, SessionResponse } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy.js'
import { type OpenfortError, toError } from '../../errors/base.js'
import { ChainNotConfiguredError } from '../../errors/config.js'
import { WalletError } from '../../errors/wallet.js'
import { getEmbeddedWalletClient } from '../../ethereum/hooks/getEmbeddedWalletClient.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import type { OpenfortHookOptions } from '../../types.js'
import { logger } from '../../utils/logger.js'
import { type BaseFlowState, mapStatus } from './auth/status.js'
import { onError, onSuccess } from './hookConsistency.js'

type RevokePermissionsRequest = {
  sessionKey: Hex
}

type RevokePermissionsResult = SessionResponse

type RevokePermissionsHookResult = {
  error?: OpenfortError
} & Partial<RevokePermissionsResult>

type RevokePermissionsHookOptions = OpenfortHookOptions<RevokePermissionsHookResult>

/**
 * Hook for revoking permissions to session keys (EIP-7715)
 *
 * Revokes a previously granted EIP-7715 permission using its permission context.
 *
 * @param hookOptions - Optional configuration with callback functions
 * @returns Current revoke permissions state and actions
 *
 * @example
 * ```tsx
 * import { useRevokePermissions } from '@openfort/react';
 *
 * const { revokePermissions, isLoading, isError, error } = useRevokePermissions({
 *   onSuccess: (result) => console.log('Permissions revoked:', result),
 *   onError: (error) => console.error('Permission revoke failed:', error),
 * });
 *
 * // Revoke the permission represented by a session-key permission context.
 * const handleRevokePermissions = async () => {
 *   const result = await revokePermissions({ sessionKey: '0x...' });
 *   if (result.error) console.error(result.error);
 * };
 * ```
 */
export const useRevokePermissions = (hookOptions: RevokePermissionsHookOptions = {}) => {
  const { chains } = useOpenfort()
  const client = useOpenfortCore((s) => s.client)
  const ethereum = useEthereumEmbeddedWallet()
  const chainId = ethereum.chainId ?? DEFAULT_TESTNET_CHAIN_ID
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const [data, setData] = useState<RevokePermissionsResult | null>(null)
  const revokePermissions = useCallback(
    async (
      { sessionKey }: RevokePermissionsRequest,
      options: RevokePermissionsHookOptions = {}
    ): Promise<RevokePermissionsHookResult> => {
      try {
        const chain = chains.find((c) => c.id === chainId)
        if (!chain) {
          throw new ChainNotConfiguredError({ chainId })
        }

        logger.log('Revoking permissions')
        setStatus({
          status: 'loading',
        })

        const revokeParams = [
          {
            permissionContext: sessionKey,
          },
        ] as [RevokePermissionsRequestParams]

        let provider: OpenfortEmbeddedEthereumWalletProvider
        if (ethereum.status === 'connected') {
          provider = await ethereum.activeWallet.getProvider()
        } else {
          provider = (await client.embeddedWallet.getEthereumProvider()) as OpenfortEmbeddedEthereumWalletProvider
          await provider.request({ method: 'eth_requestAccounts' })
        }
        const walletClient = await getEmbeddedWalletClient(provider, chain)
        const revokePermissionsResult: SessionResponse = await walletClient.request<{
          Method: 'wallet_revokePermissions'
          Parameters: [RevokePermissionsRequestParams]
          ReturnType: SessionResponse
        }>({
          method: 'wallet_revokePermissions',
          params: revokeParams,
        })

        logger.log('Permissions revoked')

        const data: RevokePermissionsResult = revokePermissionsResult

        setData(data)
        setStatus({
          status: 'success',
        })

        return onSuccess({
          hookOptions,
          options,
          data,
        })
      } catch (error) {
        const openfortError = new WalletError('Failed to revoke permissions.', { cause: toError(error) })

        setStatus({
          status: 'error',
          error: openfortError,
        })

        return onError({
          hookOptions,
          options,
          error: openfortError,
        })
      }
    },
    [chains, chainId, client, ethereum, hookOptions]
  )

  return {
    revokePermissions,
    data,
    reset: () => {
      setStatus({ status: 'idle' })
      setData(null)
    },
    ...mapStatus(status),
  }
}
