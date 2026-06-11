'use client'

import { useCallback, useState } from 'react'
import type { Chain, Hex } from 'viem'
import { createWalletClient, custom } from 'viem'
import { erc7715Actions, type GrantPermissionsParameters, type GrantPermissionsReturnType } from 'viem/experimental'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import type { OpenfortHookOptions } from '../../types'
import { logger } from '../../utils/logger'
import { type BaseFlowState, mapStatus } from './auth/status'
import { onError, onSuccess } from './hookConsistency'

type GrantPermissionsRequest = {
  request: GrantPermissionsParameters
  sessionKey: Hex
}

type GrantPermissionsResult = {
  address: `0x${string}`
} & GrantPermissionsReturnType

type GrantPermissionsHookResult = {
  error?: OpenfortError
} & Partial<GrantPermissionsResult>

type GrantPermissionsHookOptions = OpenfortHookOptions<GrantPermissionsHookResult>

/**
 * Hook for granting permissions to session keys (EIP-7715)
 *
 * This hook manages the creation and authorization of session keys, allowing users to
 * delegate permissions to specific accounts for a limited time. This enables use cases
 * like session-based authentication and gasless transactions within defined scopes.
 * The hook leverages EIP-7715 for permission granting.
 *
 * @param hookOptions - Optional configuration with callback functions
 * @returns Current grant permissions state and actions
 *
 * @example
 * ```tsx
 * import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
 * import { useGrantPermissions } from '@openfort/openfort-react';
 *
 * const { grantPermissions, isLoading, isError, error } = useGrantPermissions({
 *   onSuccess: (result) => console.log('Permissions granted:', result),
 *   onError: (error) => console.error('Permission grant failed:', error),
 * });
 *
 * // Grant permissions to a session key
 * const handleGrantPermissions = async () => {
 *   try {
 *     // Generate a new session key
 *     const sessionKey = generatePrivateKey();
 *     const accountSession = privateKeyToAccount(sessionKey).address;
 *
 *     const result = await grantPermissions({
 *       sessionKey,
 *       request: {
 *         signer: {
 *           type: 'account',
 *           data: {
 *             id: accountSession,
 *           },
 *         },
 *         expiry: 60 * 60 * 24, // 24 hours
 *         permissions: [
 *           {
 *             type: 'contract-call',
 *             data: {
 *               address: '0x2522f4fc9af2e1954a3d13f7a5b2683a00a4543a',
 *             },
 *           },
 *         ],
 *       },
 *     });
 *
 *     if (result.address) {
 *       console.log('Session created with address:', result.address);
 *       console.log('Session private key:', result.privateKey);
 *     }
 *   } catch (error) {
 *     console.error('Failed to grant permissions:', error);
 *   }
 * };
 *
 * // Check permission grant state
 * if (isLoading) {
 *   console.log('Granting permissions...');
 * } else if (isError) {
 *   console.error('Permission grant error:', error);
 * }
 *
 * // Example usage in component
 * return (
 *   <div>
 *     <button
 *       onClick={handleGrantPermissions}
 *       disabled={isLoading}
 *     >
 *       {isLoading ? 'Granting Permissions...' : 'Create Session'}
 *     </button>
 *
 *     {isError && (
 *       <p>Error: {error?.message}</p>
 *     )}
 *   </div>
 * );
 * ```
 */
async function getEmbeddedWalletClientWithErc7715(provider: OpenfortEmbeddedEthereumWalletProvider, chain: Chain) {
  const accounts = (await provider.request({ method: 'eth_accounts' })) as `0x${string}`[]
  if (!accounts?.length) throw new OpenfortError('No accounts available', OpenfortReactErrorType.WALLET_ERROR)
  const account = accounts[0]
  const transport = custom(provider)
  const baseClient = createWalletClient({ account, chain, transport })
  return baseClient.extend(erc7715Actions())
}

/**
 * Grants session key permissions for EIP-7702 / account abstraction.
 *
 * @param hookOptions - Optional callbacks and configuration
 * @returns grantPermissions(request), status, data, error
 *
 * @example
 * ```tsx
 * const { grantPermissions } = useGrantPermissions()
 * await grantPermissions({ request: { ... } })
 * ```
 */
export const useGrantPermissions = (hookOptions: GrantPermissionsHookOptions = {}) => {
  const bridge = useEthereumBridge()
  const { chains } = useOpenfort()
  const { client } = useOpenfortCore()
  const ethereum = useEthereumEmbeddedWallet()
  const chainId =
    bridge?.chainId ?? (ethereum.status === 'connected' ? ethereum.chainId : undefined) ?? DEFAULT_TESTNET_CHAIN_ID
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const [data, setData] = useState<GrantPermissionsResult | null>(null)
  const grantPermissions = useCallback(
    async (
      { request }: GrantPermissionsRequest,
      options: GrantPermissionsHookOptions = {}
    ): Promise<GrantPermissionsHookResult> => {
      try {
        logger.log('Granting permissions with request:', request)

        const chain = chains.find((c) => c.id === chainId)
        if (!chain) {
          throw new OpenfortError('No chain configured', OpenfortReactErrorType.CONFIGURATION_ERROR)
        }

        setStatus({
          status: 'loading',
        })

        let account: `0x${string}`
        let grantPermissionsResult: GrantPermissionsReturnType

        if (bridge?.getWalletClient) {
          // Wagmi connector may still be connecting after auto-recover → READY transition.
          // Poll briefly before giving up.
          let rawClient = await bridge.getWalletClient()
          for (let attempt = 0; !rawClient && attempt < 4; attempt++) {
            await new Promise((r) => setTimeout(r, 300))
            rawClient = await bridge.getWalletClient()
            if (rawClient) break
          }
          if (!rawClient) {
            throw new OpenfortError('Wallet client not available', OpenfortReactErrorType.WALLET_ERROR)
          }
          const walletClient = rawClient.extend(erc7715Actions())
          const [addr] = await walletClient.getAddresses()
          if (!addr) throw new OpenfortError('No account on wallet client', OpenfortReactErrorType.WALLET_ERROR)
          account = addr
          grantPermissionsResult = await walletClient.grantPermissions(request)
        } else {
          let provider: OpenfortEmbeddedEthereumWalletProvider
          if (ethereum.status === 'connected') {
            provider = await ethereum.activeWallet.getProvider()
          } else {
            provider = (await client.embeddedWallet.getEthereumProvider()) as OpenfortEmbeddedEthereumWalletProvider
            await provider.request({ method: 'eth_requestAccounts' })
          }
          const walletClient = await getEmbeddedWalletClientWithErc7715(provider, chain)
          const [addr] = await walletClient.getAddresses()
          if (!addr) throw new OpenfortError('No account on wallet client', OpenfortReactErrorType.WALLET_ERROR)
          account = addr
          grantPermissionsResult = await walletClient.grantPermissions(request)
        }

        const data: GrantPermissionsResult = {
          address: account,
          ...grantPermissionsResult,
        }

        logger.log('Grant permissions result:', data)

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
        const isUnsupported =
          error instanceof Error &&
          /Method not supported|grantPermissions|wallet_grantPermissions|does not support/i.test(error.message)
        const message = isUnsupported
          ? 'Session keys (grantPermissions) are not supported by the embedded wallet provider. Use an external wallet for this flow.'
          : undefined
        const openfortError = new OpenfortError(
          message ?? 'Failed to grant permissions',
          OpenfortReactErrorType.WALLET_ERROR,
          { error }
        )

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
    [bridge, chains, chainId, client, ethereum, hookOptions]
  )

  return {
    grantPermissions,
    data,
    reset: () => {
      setStatus({ status: 'idle' })
      setData(null)
    },
    ...mapStatus(status),
  }
}
