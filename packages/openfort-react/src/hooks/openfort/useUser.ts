'use client'

import { EmbeddedState } from '@openfort/openfort-js'
import { useCallback } from 'react'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { handleOAuthConfigError } from '../../utils/oauthErrorHandler'

/**
 * Returns the current user, linked accounts, auth state, and token helpers.
 *
 * Use `isConnected` for the common "am I connected?" check: true when authenticated and
 * wallet is ready for the current chain.
 *
 * @remarks Client-only. Use in a Client Component (e.g. add `"use client"` in Next.js App Router).
 *
 * @returns user, linkedAccounts, isLoading, isAuthenticated, isConnected, getAccessToken, validateAndRefreshToken
 *
 * @example
 * ```tsx
 * const { user, isConnected, getAccessToken } = useUser()
 *
 * if (!isConnected) return <Spinner />
 * // User is authenticated and wallet is connected — safe to send/sign
 *
 * const token = await getAccessToken()
 * ```
 */
export function useUser() {
  const { user, client, embeddedState, linkedAccounts, activeEmbeddedAddress, isLoading } = useOpenfortCore()

  const isAuthenticated = embeddedState !== EmbeddedState.NONE && embeddedState !== EmbeddedState.UNAUTHENTICATED
  const isConnected = embeddedState === EmbeddedState.READY && !!activeEmbeddedAddress

  const getAccessTokenAndUpdate = useCallback(async () => {
    try {
      await client.validateAndRefreshToken()
      const token = await client.getAccessToken()
      return token
    } catch (error: unknown) {
      handleOAuthConfigError(error)
      throw error
    }
  }, [client])

  const validateAndRefresh = useCallback(async () => {
    try {
      await client.validateAndRefreshToken()
    } catch (error: unknown) {
      handleOAuthConfigError(error)
      throw error
    }
  }, [client])

  return {
    user,
    linkedAccounts,
    isLoading,
    isAuthenticated,
    isConnected,
    getAccessToken: getAccessTokenAndUpdate,
    validateAndRefreshToken: validateAndRefresh,
  }
}
