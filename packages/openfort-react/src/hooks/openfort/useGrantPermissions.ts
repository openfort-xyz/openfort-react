'use client'

import { useCallback, useState } from 'react'
import type { Chain } from 'viem'
import { createWalletClient, custom } from 'viem'
import { erc7715Actions, type GrantPermissionsParameters, type GrantPermissionsReturnType } from 'viem/experimental'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { embeddedWalletId } from '../../constants/openfort.js'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy.js'
import { type OpenfortError, toError } from '../../errors/base.js'
import { ChainNotConfiguredError } from '../../errors/config.js'
import { ConnectorNotFoundError } from '../../errors/connection.js'
import { WalletError, WalletNotConnectedError } from '../../errors/wallet.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { assertEmbeddedEthereumAccount } from '../../shared/utils/assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'
import type { OpenfortHookOptions } from '../../types.js'
import { logger } from '../../utils/logger.js'
import { type BaseFlowState, mapStatus } from './auth/status.js'
import { onError, onSuccess } from './hookConsistency.js'

type GrantPermissionsRequest = {
  request: GrantPermissionsParameters
}

/** EIP-1193 `UNSUPPORTED_METHOD`. */
const UNSUPPORTED_METHOD_CODE = 4200

/** True when `error` or any of its causes carries the given EIP-1193 code. */
function hasProviderErrorCode(error: unknown, code: number): boolean {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 10; depth++) {
    if ((current as { code?: unknown }).code === code) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

type GrantPermissionsResult = {
  address: `0x${string}`
} & GrantPermissionsReturnType

type GrantPermissionsHookResult = {
  error?: OpenfortError
} & Partial<GrantPermissionsResult>

type GrantPermissionsHookOptions = OpenfortHookOptions<GrantPermissionsHookResult>

/** Creates an EIP-7715 wallet client bound to the asserted account. */
function getEmbeddedWalletClientWithErc7715(
  provider: OpenfortEmbeddedEthereumWalletProvider,
  chain: Chain,
  account: `0x${string}`
) {
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
 * import { useGrantPermissions } from '@openfort/react'
 *
 * function GrantSessionButton() {
 *   const { grantPermissions, isLoading, error } = useGrantPermissions()
 *
 *   const grant = async () => {
 *     const result = await grantPermissions({
 *       request: {
 *         signer: {
 *           type: 'account',
 *           data: { id: '0x1111111111111111111111111111111111111111' },
 *         },
 *         expiry: 86_400,
 *         permissions: [],
 *       },
 *     })
 *     if (result.error) return
 *     console.log(result.address)
 *   }
 *
 *   return <button onClick={grant} disabled={isLoading}>{error ? error.shortMessage : 'Grant session'}</button>
 * }
 * ```
 */
const DEFAULT_GRANT_HOOK_OPTIONS: GrantPermissionsHookOptions = {}

export const useGrantPermissions = (hookOptions: GrantPermissionsHookOptions = DEFAULT_GRANT_HOOK_OPTIONS) => {
  const bridge = useEthereumBridge()
  const { chains } = useOpenfort()
  const client = useOpenfortCore((s) => s.client)
  const ethereum = useEthereumEmbeddedWallet()
  const chainId =
    bridge?.chainId ?? (ethereum.status === 'connected' ? ethereum.chainId : undefined) ?? DEFAULT_TESTNET_CHAIN_ID
  // The embedded-wallet hook returns a fresh object every render, so depend on
  // the one value read from it rather than on the whole result.
  const connectedEmbeddedAddress = ethereum.status === 'connected' ? ethereum.address : undefined
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
        const intendedEmbeddedAddress =
          connectedEmbeddedAddress ??
          (bridge?.account.connector?.id === embeddedWalletId ? bridge.account.address : undefined)
        const connectorId = bridge?.account.connector?.id
        const connectorKind = !bridge
          ? 'embedded'
          : connectorId === embeddedWalletId
            ? 'embedded'
            : connectorId
              ? 'external'
              : 'unknown'

        logger.log('Granting permissions')

        const chain = chains.find((c) => c.id === chainId)
        if (!chain) {
          throw new ChainNotConfiguredError({ chainId })
        }

        setStatus({
          status: 'loading',
        })

        let account: `0x${string}`
        let grantPermissionsResult: GrantPermissionsReturnType

        if (connectorKind === 'unknown') {
          throw new ConnectorNotFoundError({ connectorId })
        }

        if (connectorKind === 'external') {
          const getExternalWalletClient = bridge?.getWalletClient
          if (!getExternalWalletClient) {
            throw new WalletNotConnectedError('Wallet client not available.')
          }
          const grantWithBridge = async () => {
            let rawClient = await getExternalWalletClient()
            for (let attempt = 0; !rawClient && attempt < 4; attempt++) {
              await new Promise((resolve) => setTimeout(resolve, 300))
              rawClient = await getExternalWalletClient()
              if (rawClient) break
            }
            if (!rawClient) {
              throw new WalletNotConnectedError('Wallet client not available.')
            }
            const walletClient = rawClient.extend(erc7715Actions())
            const [address] = await walletClient.getAddresses()
            if (!address) throw new WalletNotConnectedError('No account on wallet client.')
            return {
              account: address,
              permissions: await walletClient.grantPermissions(request),
            }
          }
          const bridgeResult = await grantWithBridge()
          account = bridgeResult.account
          grantPermissionsResult = bridgeResult.permissions
        } else {
          const embeddedResult = await runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
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
            const walletClient = getEmbeddedWalletClientWithErc7715(provider, chain, intendedAddress)
            assertCurrent()
            return {
              account: intendedAddress,
              permissions: await walletClient.grantPermissions(request),
            }
          })
          account = embeddedResult.account
          grantPermissionsResult = embeddedResult.permissions
        }

        const data: GrantPermissionsResult = {
          address: account,
          ...grantPermissionsResult,
        }

        logger.log('Permissions granted')

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
        // EIP-1193 code 4200 is the structured "unsupported method" signal.
        // Matching on the message instead would also catch the parameter
        // validation error, which names the method but is a caller mistake.
        const message = hasProviderErrorCode(error, UNSUPPORTED_METHOD_CODE)
          ? 'Session keys (grantPermissions) are not supported by the embedded wallet provider. Use an external wallet for this flow.'
          : undefined
        const openfortError =
          error instanceof ConnectorNotFoundError
            ? error
            : new WalletError(message ?? 'Failed to grant permissions.', { cause: toError(error) })

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
    [bridge, chains, chainId, client, connectedEmbeddedAddress, hookOptions]
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
