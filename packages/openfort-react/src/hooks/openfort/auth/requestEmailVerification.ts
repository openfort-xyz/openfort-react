import { ValidationError } from '../../../errors/validation.js'
export const buildCallbackUrl = ({
  email,
  callbackUrl,
  provider,
  isOpen,
  uiParam = 'openfortEmailVerificationUI',
}: {
  email?: string
  callbackUrl?: string
  provider: string
  isOpen: boolean
  /**
   * The parameter the modal routes on when the link is opened. A password
   * reset must land on the reset form, so it cannot share the email-verification
   * flag — that routes the reset token to `verifyEmail` instead.
   */
  uiParam?: 'openfortEmailVerificationUI' | 'openfortForgotPasswordUI'
}) => {
  if (callbackUrl && !callbackUrl.startsWith('http')) {
    callbackUrl = `${window.location.origin}${callbackUrl.startsWith('/') ? '' : '/'}${callbackUrl}`
  }
  const redirectUrl = new URL(callbackUrl || window.location.origin)

  // Validate that the redirect URL stays on the same origin to prevent open redirect attacks
  if (redirectUrl.origin !== window.location.origin) {
    throw new ValidationError('Invalid `callbackUrl`.', {
      details: `Origin "${redirectUrl.origin}" does not match the current origin "${window.location.origin}".`,
    })
  }

  redirectUrl.searchParams.append('openfortAuthProvider', provider)
  if (email) {
    redirectUrl.searchParams.append('email', email)
  }
  if (isOpen) {
    redirectUrl.searchParams.append(uiParam, 'true')
  }

  return redirectUrl.toString()
}
