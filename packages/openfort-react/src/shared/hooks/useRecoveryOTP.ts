'use client'

import { useCallback, useMemo } from 'react'
import { useOpenfort } from '../../components/Openfort/useOpenfort'
import { OpenfortError, OpenfortReactErrorType } from '../../core/errors'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { logger } from '../../utils/logger'

export type OTPResponse = {
  error?: OpenfortError
  sentTo?: 'email' | 'phone'
  email?: string
  phone?: string
}

export function useRecoveryOTP(): { isEnabled: boolean; requestOTP: () => Promise<OTPResponse> } {
  const { client, user } = useOpenfortCore()
  const { walletConfig } = useOpenfort()

  const isEnabled = useMemo(() => {
    return !!walletConfig && (!!walletConfig.requestWalletRecoverOTP || !!walletConfig.requestWalletRecoverOTPEndpoint)
  }, [walletConfig])

  const requestOTP = useCallback(async (): Promise<OTPResponse> => {
    try {
      logger.log('Requesting wallet recover OTP for user', { userId: user?.id })
      if (!walletConfig) {
        throw new Error('No walletConfig found')
      }

      const accessToken = await client.getAccessToken()
      if (!accessToken) {
        throw new OpenfortError('Openfort access token not found', OpenfortReactErrorType.AUTHENTICATION_ERROR)
      }
      if (!user?.id) {
        throw new OpenfortError('User not found', OpenfortReactErrorType.AUTHENTICATION_ERROR)
      }
      const userId = user.id
      const email = user.email
      const phone = user.email ? undefined : user.phoneNumber

      if (!email && !phone) {
        throw new OpenfortError('No email or phone number found for user', OpenfortReactErrorType.AUTHENTICATION_ERROR)
      }

      logger.log('Requesting wallet recover OTP for user', { userId, email, phone })
      if (walletConfig.requestWalletRecoverOTP) {
        await walletConfig.requestWalletRecoverOTP({ userId, accessToken, email, phone })
        return { sentTo: email ? 'email' : 'phone', email, phone }
      }

      if (!walletConfig.requestWalletRecoverOTPEndpoint) {
        throw new Error('No requestWalletRecoverOTPEndpoint set in walletConfig')
      }

      const resp = await fetch(walletConfig.requestWalletRecoverOTPEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, email, phone }),
      })

      if (!resp.ok) {
        throw new Error('Failed to request wallet recover OTP')
      }
      return { sentTo: email ? 'email' : 'phone', email, phone }
    } catch (err) {
      logger.log('Error requesting wallet recover OTP:', err)
      const error =
        err instanceof OpenfortError
          ? err
          : new OpenfortError('Failed to request wallet recover OTP', OpenfortReactErrorType.WALLET_ERROR)
      throw error
    }
  }, [walletConfig, client, user])

  return { isEnabled, requestOTP }
}
