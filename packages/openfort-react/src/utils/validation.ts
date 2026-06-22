export const isValidEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

type PublishableKeyEnvironment = 'test' | 'live'

/**
 * Derive the environment from an Openfort publishable key.
 *
 * Keys are formatted `pk_test_<uuid>` or `pk_live_<uuid>`. Returns `null` when
 * the prefix is unrecognized so callers can fall back to default behavior.
 */
export const getPublishableKeyEnvironment = (
  publishableKey: string | undefined | null
): PublishableKeyEnvironment | null => {
  if (publishableKey?.startsWith('pk_test_')) return 'test'
  if (publishableKey?.startsWith('pk_live_')) return 'live'
  return null
}
