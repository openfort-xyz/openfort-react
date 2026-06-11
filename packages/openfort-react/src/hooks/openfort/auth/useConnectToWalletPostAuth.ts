'use client'

import { ChainTypeEnum, EmbeddedState, RecoveryMethod } from '@openfort/openfort-js'
import { useCallback } from 'react'
import { useOpenfort } from '../../../components/Openfort/useOpenfort'
import { DEFAULT_ACCOUNT_TYPE } from '../../../constants/openfort'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { buildRecoveryParams } from '../../../shared/utils/recovery'
import { logger } from '../../../utils/logger'
import {
  type EthereumUserWallet,
  embeddedAccountToSolanaUserWallet,
  embeddedAccountToUserWallet,
  type SolanaUserWallet,
} from '../walletTypes'
import { useSignOut } from './useSignOut'

/**
 * Options that control the behaviour of {@link useConnectToWalletPostAuth} when attempting to
 * recover or create an embedded wallet after authentication.
 */
export type CreateWalletPostAuthOptions = {
  /**
   * Whether the user should be signed out if automatic wallet creation fails.
   *
   * @defaultValue true
   */
  logoutOnError?: boolean

  /**
   * Whether the hook should automatically attempt to recover an existing wallet that
   * supports automatic recovery.
   *
   * @defaultValue true
   */
  recoverWalletAutomatically?: boolean
}

/**
 * React hook that attempts to recover or create an embedded wallet once a user has authenticated.
 *
 * @returns Helpers that execute the post-authentication wallet connection flow.
 *
 * @example
 * ```ts
 * const { tryUseWallet } = useConnectToWalletPostAuth();
 *
 * const result = await tryUseWallet({ recoverWalletAutomatically: false });
 * if (!result.wallet) {
 *   console.warn('No embedded wallet available after authentication');
 * }
 * ```
 */
export const useConnectToWalletPostAuth = () => {
  const { chainType, setActiveEmbeddedAddress, embeddedState, client, activeEmbeddedAddress, updateEmbeddedAccounts } =
    useOpenfortCore()
  const { walletConfig } = useOpenfort()
  const chainId = walletConfig?.ethereum?.chainId ?? 84532
  const { signOut } = useSignOut()

  const tryUseWallet = useCallback(
    async ({
      logoutOnError: signOutOnError = true,
      recoverWalletAutomatically,
    }: CreateWalletPostAuthOptions): Promise<{
      wallet?: EthereumUserWallet | SolanaUserWallet
      passwordRequired?: boolean
    }> => {
      const connectOnLogin = walletConfig?.connectOnLogin ?? true
      const shouldRecover = recoverWalletAutomatically ?? connectOnLogin
      const shouldCreate = connectOnLogin

      if (!shouldRecover) return {}
      if (!walletConfig?.createEncryptedSessionEndpoint && !walletConfig?.getEncryptionSession) {
        return {}
      }

      // Fetch + sync accounts directly via the store — no TanStack Query peer dep needed
      const wallets = await updateEmbeddedAccounts()
      if (!wallets) return {}

      const chainWallets = wallets.filter((w) => w.chainType === chainType)

      if (chainWallets.length === 0) {
        if (!shouldCreate) {
          logger.log('tryUseWallet: no wallet for chain, connectOnLogin=false, skipping creation')
          return {}
        }
        try {
          const recoveryParams = await buildRecoveryParams(
            { recoveryMethod: undefined },
            {
              walletConfig,
              getAccessToken: () => client.getAccessToken(),
              getUserId: async () => (await client.user.get())?.id,
            }
          )
          const accountType = walletConfig?.ethereum?.accountType ?? DEFAULT_ACCOUNT_TYPE
          const account = await client.embeddedWallet.create({
            chainType,
            accountType: chainType === ChainTypeEnum.EVM ? accountType : DEFAULT_ACCOUNT_TYPE,
            ...(chainType === ChainTypeEnum.EVM && accountType !== DEFAULT_ACCOUNT_TYPE && { chainId }),
            recoveryParams,
          })
          await updateEmbeddedAccounts({ silent: true })
          setActiveEmbeddedAddress(account.address)
          return {
            wallet:
              chainType === ChainTypeEnum.SVM
                ? embeddedAccountToSolanaUserWallet(account)
                : embeddedAccountToUserWallet(account),
          }
        } catch (err) {
          logger.error('Error creating wallet:', err)
          if (signOutOnError) await signOut()
          return {}
        }
      }

      // Prefer automatic recovery, then passkey — these can be recovered without user input.
      const autoRecoverableWallet =
        chainWallets.find((w) => w.recoveryMethod === RecoveryMethod.AUTOMATIC) ??
        chainWallets.find((w) => w.recoveryMethod === RecoveryMethod.PASSKEY)

      if (autoRecoverableWallet) {
        // If the embedded signer isn't READY yet, skip recover() — the state machine in
        // CoreOpenfortProvider will handle wallet connection once READY is reached.
        // Calling recover() before READY races against the state machine's own recovery.
        if (embeddedState !== EmbeddedState.READY) {
          // Store the intended address so the state machine activates it when READY
          setActiveEmbeddedAddress(autoRecoverableWallet.address)
          return {
            wallet:
              chainType === ChainTypeEnum.SVM
                ? embeddedAccountToSolanaUserWallet(autoRecoverableWallet)
                : embeddedAccountToUserWallet(autoRecoverableWallet),
          }
        }

        // Check already-active using store state — no chain-specific wallet hook needed
        const alreadyActive =
          activeEmbeddedAddress != null &&
          (chainType === ChainTypeEnum.SVM
            ? activeEmbeddedAddress === autoRecoverableWallet.address
            : activeEmbeddedAddress.toLowerCase() === autoRecoverableWallet.address.toLowerCase())
        if (alreadyActive) {
          return {
            wallet:
              chainType === ChainTypeEnum.SVM
                ? embeddedAccountToSolanaUserWallet(autoRecoverableWallet)
                : embeddedAccountToUserWallet(autoRecoverableWallet),
          }
        }

        try {
          // Configure signer directly — no chain-specific wallet hook import needed
          const recoveryParams = await buildRecoveryParams(
            {
              recoveryMethod:
                autoRecoverableWallet.recoveryMethod === RecoveryMethod.PASSKEY ? RecoveryMethod.PASSKEY : undefined,
              passkeyId:
                autoRecoverableWallet.recoveryMethod === RecoveryMethod.PASSKEY
                  ? autoRecoverableWallet.recoveryMethodDetails?.passkeyId
                  : undefined,
            },
            {
              walletConfig,
              getAccessToken: () => client.getAccessToken(),
              getUserId: async () => (await client.user.get())?.id,
            }
          )
          await client.embeddedWallet.recover({ account: autoRecoverableWallet.id, recoveryParams })
          setActiveEmbeddedAddress(autoRecoverableWallet.address)
          return {
            wallet:
              chainType === ChainTypeEnum.SVM
                ? embeddedAccountToSolanaUserWallet(autoRecoverableWallet)
                : embeddedAccountToUserWallet(autoRecoverableWallet),
          }
        } catch (_err) {
          if (signOutOnError) await signOut()
          return {}
        }
      }

      // Password recovery requires user input — signal the caller
      if (chainWallets.some((w) => w.recoveryMethod === RecoveryMethod.PASSWORD)) {
        return { wallet: undefined, passwordRequired: true }
      }

      const first = chainWallets[0]
      return {
        wallet: first
          ? chainType === ChainTypeEnum.SVM
            ? embeddedAccountToSolanaUserWallet(first)
            : embeddedAccountToUserWallet(first)
          : undefined,
      }
    },
    [
      chainType,
      client,
      walletConfig,
      chainId,
      signOut,
      embeddedState,
      setActiveEmbeddedAddress,
      updateEmbeddedAccounts,
      activeEmbeddedAddress,
    ]
  )

  return {
    tryUseWallet,
  }
}
