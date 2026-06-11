'use client'

import type { RevokePermissionsRequestParams, SessionResponse } from '@openfort/openfort-js'
import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import { getEmbeddedWalletClient } from '../../ethereum/hooks/getEmbeddedWalletClient'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import type { OpenfortHookOptions } from '../../types'
import { logger } from '../../utils/logger'
import { type BaseFlowState, mapStatus } from './auth/status'
import { onError, onSuccess } from './hookConsistency'

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
 * This hook manages the creation and authorization of session keys, allowing users to
 * delegate permissions to specific accounts for a limited time. This enables use cases
 * like session-based authentication and gasless transactions within defined scopes.
 * The hook leverages EIP-7715 for permission revocation.
 *
 * @param hookOptions - Optional configuration with callback functions
 * @returns Current revoke permissions state and actions
 *
 * @example
 * ```tsx
 * import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
 * import { useRevokePermissions } from '@openfort/openfort-react';
 *
 * const { revokePermissions, isLoading, isError, error } = useRevokePermissions({
 *   onSuccess: (result) => console.log('Permissions revoked:', result),
 *   onError: (error) => console.error('Permission revoke failed:', error),
 * });
 *
 * // Revoke Permissions to a session key
 * const handleRevokePermissions = async () => {
 *   try {
 *     const sessionKey = '0x...'; // The session key to revoke permissions for
 *
 *     const result = await revokePermissions({
 *       sessionKey,
 *     });
 *
 *     console.log('Revoke result:', result);
 *   } catch (error) {
 *     console.error('Error revoking permissions:', error);
 *   }
 * };
 * ```
 */
export const useRevokePermissions = (hookOptions: RevokePermissionsHookOptions = {}) => {
  const { chains } = useOpenfort()
  const { client } = useOpenfortCore()
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
          throw new OpenfortError('No chain configured', OpenfortReactErrorType.CONFIGURATION_ERROR)
        }

        logger.log('Revoking permissions for session key:', sessionKey)
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

        logger.log('Revoke permissions result:', revokePermissionsResult)

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
        const openfortError = new OpenfortError('Failed to revoke permissions', OpenfortReactErrorType.WALLET_ERROR, {
          error,
        })

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
