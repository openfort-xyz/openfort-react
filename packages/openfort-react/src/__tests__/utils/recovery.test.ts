import { RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRecoveryParams } from '../../shared/utils/recovery'
import { OpenfortReactErrorType } from '../../types'

const BASE_CONFIG = {
  walletConfig: undefined as unknown as never,
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  getUserId: vi.fn<() => Promise<string | undefined>>(),
}

describe('buildRecoveryParams', () => {
  describe('PASSWORD method', () => {
    it('throws CONFIGURATION_ERROR when password is missing', async () => {
      await expect(buildRecoveryParams({ recoveryMethod: RecoveryMethod.PASSWORD }, BASE_CONFIG)).rejects.toMatchObject(
        {
          type: OpenfortReactErrorType.CONFIGURATION_ERROR,
        }
      )
    })

    it('returns password params when password is provided', async () => {
      const result = await buildRecoveryParams(
        { recoveryMethod: RecoveryMethod.PASSWORD, password: 'secret' },
        BASE_CONFIG
      )
      expect(result).toEqual({ recoveryMethod: RecoveryMethod.PASSWORD, password: 'secret' })
    })
  })

  describe('AUTOMATIC method (endpoint path)', () => {
    const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch)
      BASE_CONFIG.getAccessToken.mockResolvedValue('access-token')
      BASE_CONFIG.getUserId.mockResolvedValue('user-123')
    })

    const walletConfig = {
      createEncryptedSessionEndpoint: 'https://example.com/session',
    }

    it('returns encryptionSession on valid response', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ session: 'valid-session-token' }), { status: 200 }))

      const result = await buildRecoveryParams(
        { recoveryMethod: RecoveryMethod.AUTOMATIC },
        { ...BASE_CONFIG, walletConfig: walletConfig as never }
      )
      expect(result).toEqual({
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        encryptionSession: 'valid-session-token',
      })
    })

    it('throws WALLET_ERROR when data.session is missing', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ other: 'field' }), { status: 200 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.WALLET_ERROR,
        message: 'Invalid encryption session response',
      })
    })

    it('throws WALLET_ERROR when data.session is empty string', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ session: '' }), { status: 200 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.WALLET_ERROR,
      })
    })

    it('throws AUTHENTICATION_ERROR when OTP_REQUIRED', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'OTP_REQUIRED' }), { status: 401 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.AUTHENTICATION_ERROR,
      })
    })

    it('throws WALLET_ERROR on other non-ok responses', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.WALLET_ERROR,
      })
    })

    it('throws CONFIGURATION_ERROR when no encryption config', async () => {
      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.CONFIGURATION_ERROR,
      })
    })
  })

  describe('AUTOMATIC method (callback path)', () => {
    beforeEach(() => {
      BASE_CONFIG.getAccessToken.mockResolvedValue('access-token')
      BASE_CONFIG.getUserId.mockResolvedValue('user-123')
    })

    it('returns encryptionSession from callback', async () => {
      const walletConfig = {
        getEncryptionSession: vi.fn().mockResolvedValue('callback-session'),
      }

      const result = await buildRecoveryParams(
        { recoveryMethod: RecoveryMethod.AUTOMATIC },
        { ...BASE_CONFIG, walletConfig: walletConfig as never }
      )
      expect(result).toEqual({
        recoveryMethod: RecoveryMethod.AUTOMATIC,
        encryptionSession: 'callback-session',
      })
    })

    it('throws WALLET_ERROR when callback returns undefined', async () => {
      const walletConfig = {
        getEncryptionSession: vi.fn().mockResolvedValue(undefined),
      }

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.WALLET_ERROR,
        message: 'getEncryptionSession returned invalid session',
      })
    })

    it('throws WALLET_ERROR when callback returns empty string', async () => {
      const walletConfig = {
        getEncryptionSession: vi.fn().mockResolvedValue(''),
      }

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.WALLET_ERROR,
      })
    })
  })

  describe('AUTOMATIC method — missing auth', () => {
    it('throws AUTHENTICATION_ERROR when access token is null', async () => {
      BASE_CONFIG.getAccessToken.mockResolvedValue(null)

      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.AUTHENTICATION_ERROR,
      })
    })

    it('throws AUTHENTICATION_ERROR when userId is undefined', async () => {
      BASE_CONFIG.getAccessToken.mockResolvedValue('token')
      BASE_CONFIG.getUserId.mockResolvedValue(undefined)

      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        type: OpenfortReactErrorType.AUTHENTICATION_ERROR,
      })
    })
  })
})
