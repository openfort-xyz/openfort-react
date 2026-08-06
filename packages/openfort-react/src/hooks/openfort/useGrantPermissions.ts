'use client'

import { useCallback, useRef, useState } from 'react'
import type { Chain } from 'viem'
import { createWalletClient, custom } from 'viem'
import { erc7715Actions, type GrantPermissionsParameters, type GrantPermissionsReturnType } from 'viem/experimental'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { embeddedWalletId } from '../../constants/openfort.js'
import { DEFAULT_TESTNET_CHAIN_ID } from '../../core/ConnectionStrategy.js'
import { type OpenfortError, toError } from '../../errors/base.js'
import { ChainNotConfiguredError } from '../../errors/config.js'
import { ConnectorNotFoundError } from '../../errors/connection.js'
import { ValidationError } from '../../errors/validation.js'
import { WalletError, WalletNotConnectedError } from '../../errors/wallet.js'
import { useEthereumEmbeddedWallet } from '../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { assertEmbeddedEthereumAccount } from '../../shared/utils/assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from '../../shared/utils/embeddedSignerOperationQueue.js'
import type { OpenfortHookOptions } from '../../types.js'
import { logger } from '../../utils/logger.js'
import { useLatest } from '../useLatest.js'
import { type BaseFlowState, mapStatus } from './auth/status.js'
import { NO_HOOK_OPTIONS, onError, onSuccess } from './hookConsistency.js'

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
 *         // Seconds from now, not a timestamp.
 *         expiry: 86_400,
 *         // An empty list means no destination check at all — scope it.
 *         permissions: [
 *           {
 *             type: 'contract-call',
 *             data: {
 *               address: '0x2222222222222222222222222222222222222222',
 *               calls: ['transfer(address,uint256)'],
 *             },
 *             policies: [{ type: 'gas-limit', data: { limit: 1_000_000n } }],
 *           },
 *         ],
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
/** Anything longer is far likelier to be a timestamp than an intended lifetime. */
const TEN_YEARS_IN_SECONDS = 10 * 365 * 24 * 60 * 60

export const useGrantPermissions = (hookOptions: GrantPermissionsHookOptions = NO_HOOK_OPTIONS) => {
  const hookOptionsRef = useLatest(hookOptions)
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
  // A second click before the first settles would mint a second session
  // key. The button's disabled state is not enough: the click can land
  // before React re-renders.
  const inFlightRef = useRef(false)

  const grantPermissions = useCallback(
    async (
      { request }: GrantPermissionsRequest,
      options: GrantPermissionsHookOptions = {}
    ): Promise<GrantPermissionsHookResult> => {
      if (inFlightRef.current) {
        // Routed through onError like every other failure: a consumer driving
        // its UI from callbacks alone would otherwise never learn the call was
        // refused. The first call's status is left untouched.
        return onError({
          hookOptions: hookOptionsRef.current,
          options,
          error: new ValidationError('A grant is already in progress.'),
        })
      }
      inFlightRef.current = true
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

        // An empty list is not "no restrictions to add" — the backend skips the
        // destination check entirely when the whitelist is empty, so the key
        // becomes callable on any contract. Refuse rather than silently grant it.
        if (Array.isArray(request.permissions) && request.permissions.length === 0) {
          throw new ValidationError('Refusing to grant a session key with no permissions.', {
            details:
              'An empty `permissions` array places no restriction on what the key may call. List the contract calls the key is allowed to make.',
          })
        }

        // `expiry` is a duration in seconds, not a timestamp. Passing a
        // timestamp (the shape viem's re-exported type documents) yields a key
        // valid for roughly the age of the epoch — decades rather than the hour
        // that was meant.
        if (typeof request.expiry === 'number' && request.expiry > TEN_YEARS_IN_SECONDS) {
          throw new ValidationError('The session-key expiry looks like a timestamp, not a duration.', {
            details: `\`expiry\` is the number of seconds the key stays valid. Received ${request.expiry}, which would keep it alive for over ten years.`,
          })
        }

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
          hookOptions: hookOptionsRef.current,
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
        // Wrapped, because "failed to grant permissions" is context the caller
        // does not otherwise have — except for the refusals raised above, whose
        // class is the whole point: a consumer branches on ValidationError to
        // tell "you asked for something unsafe" from "the wallet failed".
        const openfortError =
          error instanceof ValidationError || error instanceof ConnectorNotFoundError
            ? error
            : new WalletError(message ?? 'Failed to grant permissions.', { cause: toError(error) })

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
    [bridge, chains, chainId, client, connectedEmbeddedAddress]
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
