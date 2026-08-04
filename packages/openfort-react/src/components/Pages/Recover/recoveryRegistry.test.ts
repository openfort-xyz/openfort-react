import { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { OtpRequiredError, RecoveryError } from '../../../errors/wallet.js'
import { recoveryRegistry } from './recoveryRegistry.js'

const wallet = {
  id: 'emb_test',
  address: '0x0000000000000000000000000000000000000001',
  recoveryMethod: RecoveryMethod.AUTOMATIC,
  accounts: [{ id: 'account_test' }],
}

function context(result: { error?: Error; needsRecovery?: boolean }) {
  return {
    setActive: vi.fn().mockResolvedValue(result),
    setRoute: vi.fn(),
    setError: vi.fn(),
    otp: { isEnabled: true, request: vi.fn().mockResolvedValue({ email: 't***@example.com' }) },
    setNeedsOTP: vi.fn(),
    setOtpResponse: vi.fn(),
  }
}

describe('recoveryRegistry', () => {
  it('does not route password recovery after a resolved action error', async () => {
    const ctx = context({ error: new RecoveryError('Wrong password.') })

    await recoveryRegistry[ChainTypeEnum.EVM].password(wallet, { ...ctx, password: 'wrong' })

    expect(ctx.setRoute).not.toHaveBeenCalled()
    expect(ctx.setError).toHaveBeenLastCalledWith(expect.stringContaining('Wrong password.'))
  })

  it('keeps OTP-required automatic recovery observable', async () => {
    const ctx = context({ error: new OtpRequiredError({ canRequestOtp: true }) })

    const outcome = await recoveryRegistry[ChainTypeEnum.EVM].automatic(wallet, ctx)

    expect(outcome).toEqual({ status: 'otp-required' })
    expect(ctx.setRoute).not.toHaveBeenCalled()
    expect(ctx.otp.request).toHaveBeenCalledOnce()
    expect(ctx.setNeedsOTP).toHaveBeenCalledWith(true)
    expect(ctx.setOtpResponse).toHaveBeenCalledWith({ email: 't***@example.com' })
  })

  it('returns an error outcome when automatic recovery resolves with an action error', async () => {
    const ctx = context({ error: new RecoveryError('Invalid code.') })

    const outcome = await recoveryRegistry[ChainTypeEnum.EVM].automatic(wallet, { ...ctx, otpCode: '123456789' })

    expect(outcome).toEqual({ status: 'error' })
    expect(ctx.setError).toHaveBeenLastCalledWith(expect.stringContaining('Invalid code.'))
    expect(ctx.setRoute).not.toHaveBeenCalled()
  })

  it('returns success without routing so the active recovery screen controls navigation', async () => {
    const ctx = context({ needsRecovery: false })

    const outcome = await recoveryRegistry[ChainTypeEnum.EVM].automatic(wallet, ctx)

    expect(outcome).toEqual({ status: 'success' })
    expect(ctx.setRoute).not.toHaveBeenCalled()
  })
})
