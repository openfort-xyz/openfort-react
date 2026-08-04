import { RecoveryMethod } from '@openfort/openfort-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleOtpRecoveryError } from '../../shared/utils/otpError.js'
import { buildRecoveryParams } from '../../shared/utils/recovery.js'

const BASE_CONFIG = {
  walletConfig: undefined as unknown as never,
  getAccessToken: vi.fn<() => Promise<string | null>>(),
  getUserId: vi.fn<() => Promise<string | undefined>>(),
}

describe('buildRecoveryParams', () => {
  describe('PASSWORD method', () => {
    it('throws MissingParameterError when password is missing', async () => {
      await expect(buildRecoveryParams({ recoveryMethod: RecoveryMethod.PASSWORD }, BASE_CONFIG)).rejects.toMatchObject(
        {
          name: 'MissingParameterError',
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

    it('throws RecoveryError when data.session is missing', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ other: 'field' }), { status: 200 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        name: 'RecoveryError',
        shortMessage: 'Invalid encryption session response.',
      })
    })

    it('throws RecoveryError when data.session is empty string', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ session: '' }), { status: 200 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        name: 'RecoveryError',
      })
    })

    it('preserves OTP_REQUIRED as a typed, classifiable recovery error', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'OTP_REQUIRED' }), { status: 401 }))

      const operation = buildRecoveryParams(
        { recoveryMethod: RecoveryMethod.AUTOMATIC },
        { ...BASE_CONFIG, walletConfig: walletConfig as never }
      )

      await expect(operation).rejects.toMatchObject({
        name: 'OtpRequiredError',
      })
      const error = await operation.catch((cause: unknown) => cause)
      expect(handleOtpRecoveryError(error, true)).toMatchObject({ isOTPRequired: true })
    })

    it('throws RecoveryError on other non-ok responses', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ error: 'INTERNAL_ERROR' }), { status: 500 }))

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        name: 'RecoveryError',
      })
    })

    it('throws OpenfortConfigError when no encryption config', async () => {
      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        name: 'OpenfortConfigError',
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

    it('throws RecoveryError when callback returns undefined', async () => {
      const walletConfig = {
        getEncryptionSession: vi.fn().mockResolvedValue(undefined),
      }

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        name: 'RecoveryError',
        shortMessage: '`getEncryptionSession` returned an invalid session.',
      })
    })

    it('throws RecoveryError when callback returns empty string', async () => {
      const walletConfig = {
        getEncryptionSession: vi.fn().mockResolvedValue(''),
      }

      await expect(
        buildRecoveryParams(
          { recoveryMethod: RecoveryMethod.AUTOMATIC },
          { ...BASE_CONFIG, walletConfig: walletConfig as never }
        )
      ).rejects.toMatchObject({
        name: 'RecoveryError',
      })
    })
  })

  describe('AUTOMATIC method — missing auth', () => {
    it('throws NotAuthenticatedError when access token is null', async () => {
      BASE_CONFIG.getAccessToken.mockResolvedValue(null)

      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        name: 'NotAuthenticatedError',
      })
    })

    it('throws NotAuthenticatedError when userId is undefined', async () => {
      BASE_CONFIG.getAccessToken.mockResolvedValue('token')
      BASE_CONFIG.getUserId.mockResolvedValue(undefined)

      await expect(
        buildRecoveryParams({ recoveryMethod: RecoveryMethod.AUTOMATIC }, { ...BASE_CONFIG, walletConfig: {} as never })
      ).rejects.toMatchObject({
        name: 'NotAuthenticatedError',
      })
    })
  })
})
