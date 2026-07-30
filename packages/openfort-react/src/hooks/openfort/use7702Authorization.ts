'use client'

import { useCallback } from 'react'
import { type AuthorizationRequest, type Hex, parseSignature, type SignedAuthorization } from 'viem'
import { hashAuthorization } from 'viem/utils'
import { toError } from '../../errors/base.js'
import { ClientNotInitializedError } from '../../errors/config.js'
import { MissingParameterError } from '../../errors/validation.js'
import { WalletError } from '../../errors/wallet.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'

export type SignAuthorizationParameters = AuthorizationRequest

export type SignAuthorizationReturnType = SignedAuthorization

type SignAuthorizationOptions = {
  hashMessage: boolean
  arrayifyMessage: boolean
}

/**
 * Hook for signing EIP-7702 wallet authorizations
 *
 * This hook leverages the embedded Openfort client to sign authorization payloads prepared via viem.
 * It mirrors viem's `signAuthorization` behaviour while always returning the structured authorization object,
 * keeping private key management inside the Openfort SDK.
 *
 * @returns Helper with a `signAuthorization` function that signs authorizations with the active Openfort wallet
 *
 * @example
 * ```ts
 * import { prepareAuthorization } from 'viem/actions';
 * import { use7702Authorization } from '@openfort/openfort-react';
 *
 * const { signAuthorization } = use7702Authorization();
 *
 * const authorization = await prepareAuthorization(pimlicoClient, {
 *   account: eoaAccount.address,
 *   contractAddress: implementationAddress,
 * });
 *
 * const signedAuthorization = await signAuthorization({
 *   ...authorization,
 * });
 * ```
 */
export function use7702Authorization() {
  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const { client } = useOpenfortCore()

  // biome-ignore lint/correctness/useHookAtTopLevel: use7702Authorization is a valid hook name
  const signAuthorization = useCallback(
    async (
      parameters: SignAuthorizationParameters,
      options: SignAuthorizationOptions = {
        hashMessage: false,
        arrayifyMessage: false,
      }
    ): Promise<SignAuthorizationReturnType> => {
      if (!client) {
        throw new ClientNotInitializedError()
      }

      const authorization = parameters

      if (!authorization.contractAddress) {
        throw new MissingParameterError({ params: ['authorization.contractAddress'] })
      }

      const hash = hashAuthorization(authorization)

      try {
        const signature = await client.embeddedWallet.signMessage(hash, {
          hashMessage: options.hashMessage,
          arrayifyMessage: options.arrayifyMessage,
        })

        const { r, s, v, yParity } = parseSignature(signature as Hex)

        return {
          address: authorization.contractAddress,
          chainId: authorization.chainId,
          nonce: authorization.nonce,
          r,
          s,
          v,
          yParity,
        } as SignAuthorizationReturnType
      } catch (error) {
        throw new WalletError('Failed to sign authorization.', { cause: toError(error) })
      }
    },
    [client]
  )

  return { signAuthorization }
}
