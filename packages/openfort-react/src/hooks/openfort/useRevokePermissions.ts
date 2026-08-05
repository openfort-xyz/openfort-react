'use client'

import type { RevokePermissionsRequestParams, SessionResponse } from '@openfort/openfort-js'
import { useCallback, useRef, useState } from 'react'
import type { Hex } from 'viem'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy.js'
import { type OpenfortError, toError } from '../../errors/base.js'
import { ChainNotConfiguredError } from '../../errors/config.js'
import { ValidationError } from '../../errors/validation.js'
import { WalletError, WalletNotConnectedError } from '../../errors/wallet.js'
import { getEmbeddedWalletClient } from '../../ethereum/hooks/getEmbeddedWalletClient.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { assertEmbeddedEthereumAccount } from '../../shared/utils/assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'
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
const DEFAULT_REVOKE_HOOK_OPTIONS: RevokePermissionsHookOptions = {}

export const useRevokePermissions = (hookOptions: RevokePermissionsHookOptions = DEFAULT_REVOKE_HOOK_OPTIONS) => {
  // Held in a ref rather than a dependency: a consumer passing an inline
  // options object would otherwise give every action a new identity on each
  // render, so an effect depending on one would re-fire forever.
  const hookOptionsRef = useRef(hookOptions)
  hookOptionsRef.current = hookOptions
  const { chains } = useOpenfort()
  const client = useOpenfortCore((s) => s.client)
  const ethereum = useEthereumEmbeddedWallet()
  const chainId = ethereum.chainId ?? DEFAULT_TESTNET_CHAIN_ID
  // The embedded-wallet hook returns a fresh object every render, so depend on
  // the one value read from it rather than on the whole result.
  const connectedEmbeddedAddress = ethereum.status === 'connected' ? ethereum.address : undefined
  const [status, setStatus] = useState<BaseFlowState>({
    status: 'idle',
  })
  const [data, setData] = useState<RevokePermissionsResult | null>(null)
  // A second click before the first settles would mint a second session
  // key. The button's disabled state is not enough: the click can land
  // before React re-renders.
  const inFlightRef = useRef(false)

  const revokePermissions = useCallback(
    async (
      { sessionKey }: RevokePermissionsRequest,
      options: RevokePermissionsHookOptions = {}
    ): Promise<RevokePermissionsHookResult> => {
      const intendedEmbeddedAddress = connectedEmbeddedAddress
      if (inFlightRef.current) {
        // Routed through onError like every other failure: a consumer driving
        // its UI from callbacks alone would otherwise never learn the call was
        // refused. The first call's status is left untouched.
        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error: new ValidationError('A revoke is already in progress.'),
        })
      }
      inFlightRef.current = true
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

        const revokePermissionsResult = await runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
          const provider = (await client.embeddedWallet.getEthereumProvider({
            announceProvider: false,
          })) as OpenfortEmbeddedEthereumWalletProvider
          assertCurrent()
          let intendedAddress = intendedEmbeddedAddress
          if (!intendedAddress) {
            assertCurrent()
            const requestedAccounts = (await provider.request({ method: 'eth_requestAccounts' })) as
              | `0x${string}`[]
              | undefined
            assertCurrent()
            intendedAddress = requestedAccounts?.[0]
          }
          if (!intendedAddress) throw new WalletNotConnectedError('No account on wallet client.')
          await assertEmbeddedEthereumAccount(provider, intendedAddress, chain.id)
          assertCurrent()
          const walletClient = await getEmbeddedWalletClient(provider, chain)
          assertCurrent()
          return walletClient.request<{
            Method: 'wallet_revokePermissions'
            Parameters: [RevokePermissionsRequestParams]
            ReturnType: SessionResponse
          }>({
            method: 'wallet_revokePermissions',
            params: revokeParams,
          })
        })

        logger.log('Permissions revoked')

        const data: RevokePermissionsResult = revokePermissionsResult

        setData(data)
        setStatus({
          status: 'success',
        })

        return onSuccess({
          hookOptions: hookOptionsRef.current,
          options,
          data,
        })
      } catch (error) {
        // Wrapped for context, except the in-flight refusal above, whose class
        // is what a consumer branches on. See useGrantPermissions.
        const openfortError =
          error instanceof ValidationError
            ? error
            : new WalletError('Failed to revoke permissions.', { cause: toError(error) })

        setStatus({
          status: 'error',
          error: openfortError,
        })

        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error: openfortError,
        })
      } finally {
        inFlightRef.current = false
      }
    },
    [chains, chainId, client, connectedEmbeddedAddress]
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
