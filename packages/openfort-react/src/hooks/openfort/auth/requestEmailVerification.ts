export const buildCallbackUrl = ({
  email,
  callbackUrl,
  provider,
  isOpen,
}: {
  email?: string
  callbackUrl?: string
  provider: string
  isOpen: boolean
}) => {
  if (callbackUrl && !callbackUrl.startsWith('http')) {
    callbackUrl = `${window.location.origin}${callbackUrl.startsWith('/') ? '' : '/'}${callbackUrl}`
  }
  const redirectUrl = new URL(callbackUrl || window.location.origin)

  // Validate that the redirect URL stays on the same origin to prevent open redirect attacks
  if (redirectUrl.origin !== window.location.origin) {
    throw new Error(
      `Invalid callbackUrl: origin "${redirectUrl.origin}" does not match current origin "${window.location.origin}"`
    )
  }

  redirectUrl.searchParams.append('openfortAuthProvider', provider)
  if (email) {
    redirectUrl.searchParams.append('email', email)
  }
  if (isOpen) {
    redirectUrl.searchParams.append('openfortEmailVerificationUI', 'true')
  }

  return redirectUrl.toString()
}
