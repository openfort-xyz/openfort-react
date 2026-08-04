'use client'

import { useCallback, useMemo } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort.js'
import { NotAuthenticatedError } from '../../errors/auth.js'
import { asOpenfortError, type OpenfortError } from '../../errors/base.js'
import { WalletConfigNotFoundError } from '../../errors/config.js'
import { ApiRequestError } from '../../errors/operation.js'
import { RecoveryError } from '../../errors/wallet.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { logger } from '../../utils/logger.js'
import { fetchRecoveryRequest } from '../utils/recoveryRequest.js'

export type OTPResponse = {
  error?: OpenfortError
  sentTo?: 'email' | 'phone'
  email?: string
  phone?: string
}

export function useRecoveryOTP(): { isEnabled: boolean; requestOTP: () => Promise<OTPResponse> } {
  const client = useOpenfortCore((s) => s.client)
  const user = useOpenfortCore((s) => s.user)
  const { walletConfig } = useOpenfort()

  const isEnabled = useMemo(() => {
    return !!walletConfig && (!!walletConfig.requestWalletRecoverOTP || !!walletConfig.requestWalletRecoverOTPEndpoint)
  }, [walletConfig])

  const requestOTP = useCallback(async (): Promise<OTPResponse> => {
    try {
      logger.log('Requesting wallet recovery OTP')
      if (!walletConfig) {
        throw new WalletConfigNotFoundError()
      }

      const accessToken = await client.getAccessToken()
      if (!accessToken) {
        throw new NotAuthenticatedError('Openfort access token not found.')
      }
      if (!user?.id) {
        throw new NotAuthenticatedError('User not found.')
      }
      const userId = user.id
      const email = user.email
      const phone = user.email ? undefined : user.phoneNumber

      if (!email && !phone) {
        throw new NotAuthenticatedError('No email or phone number found for user.')
      }

      if (walletConfig.requestWalletRecoverOTP) {
        await walletConfig.requestWalletRecoverOTP({ userId, accessToken, email, phone })
        return { sentTo: email ? 'email' : 'phone', email, phone }
      }

      if (!walletConfig.requestWalletRecoverOTPEndpoint) {
        throw new RecoveryError('No `requestWalletRecoverOTPEndpoint` set in `walletConfig`.')
      }

      const resp = await fetchRecoveryRequest(
        walletConfig.requestWalletRecoverOTPEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId, email, phone }),
        },
        'Request wallet recovery OTP'
      )

      if (!resp.ok) {
        throw new ApiRequestError({ operation: 'Wallet recovery OTP request', status: resp.status })
      }
      return { sentTo: email ? 'email' : 'phone', email, phone }
    } catch (err) {
      logger.log('Error requesting wallet recover OTP:', err)
      throw asOpenfortError(err, (cause) => new RecoveryError('Failed to request wallet recover OTP.', { cause }))
    }
  }, [walletConfig, client, user])

  return { isEnabled, requestOTP }
}
