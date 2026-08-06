import { ValidationError } from '../errors/validation.js'

const REFERRER_META_ID = '__openfort_no_referrer'
let activeReferrerSuppressions = 0
let managedReferrerMeta: HTMLMetaElement | null = null
let managedReferrerMetaWasCreated = false
let previousReferrerPolicy: string | null = null

/**
 * Applies a document-wide no-referrer policy until every active caller restores it.
 */
export function suppressReferrer(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (activeReferrerSuppressions === 0) {
    const existingMeta = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    managedReferrerMeta = existingMeta ?? document.createElement('meta')
    managedReferrerMetaWasCreated = !existingMeta
    previousReferrerPolicy = existingMeta?.getAttribute('content') ?? null

    if (managedReferrerMetaWasCreated) {
      managedReferrerMeta.id = REFERRER_META_ID
      managedReferrerMeta.name = 'referrer'
      document.head.appendChild(managedReferrerMeta)
    }
    managedReferrerMeta.content = 'no-referrer'
  }

  activeReferrerSuppressions += 1
  let restored = false

  return () => {
    if (restored) return
    restored = true
    activeReferrerSuppressions -= 1
    if (activeReferrerSuppressions > 0) return

    const meta = managedReferrerMeta
    if (meta?.getAttribute('content') === 'no-referrer') {
      if (managedReferrerMetaWasCreated) {
        meta.remove()
      } else if (previousReferrerPolicy === null) {
        meta.removeAttribute('content')
      } else {
        meta.content = previousReferrerPolicy
      }
    }

    managedReferrerMeta = null
    managedReferrerMetaWasCreated = false
    previousReferrerPolicy = null
  }
}

/**
 * Every parameter an auth callback can carry, stripped from the address bar
 * once it has been read.
 *
 * One list, because two call sites strip these and the copy that omitted
 * `refresh_token` left it sitting in the URL, the session history and the next
 * request's `Referer`. Anything the callback can carry belongs here, whether or
 * not the stripping site happens to read it.
 */
export const CALLBACK_URL_PARAMS = [
  'openfortAuthProvider',
  'openfortAuthProviderUI',
  'openfortEmailVerificationUI',
  'openfortForgotPasswordUI',
  'access_token',
  'refresh_token',
  'user_id',
  'player_id',
  'state',
  'email',
  'error',
] as const

/** Removes every callback parameter from `url`, in place. */
export function stripCallbackParams(url: URL): void {
  for (const key of CALLBACK_URL_PARAMS) url.searchParams.delete(key)
}

/**
 * Parses callback URLs that contain a second query delimiter, such as
 * `https://example.com/callback?existing=1?access_token=xxx&user_id=yyy`.
 *
 * Only the part before the fragment is repaired. A hash router puts its own
 * `?` inside the fragment (`#/dashboard?tab=1`), and rewriting that one to `&`
 * corrupts the host application's route — which then gets written back to the
 * address bar by the `replaceState` that follows.
 */
export function parseCallbackUrl(href: string): URL {
  const hashAt = href.indexOf('#')
  const beforeFragment = hashAt === -1 ? href : href.slice(0, hashAt)
  const fragment = hashAt === -1 ? '' : href.slice(hashAt)

  const firstQ = beforeFragment.indexOf('?')
  if (firstQ === -1) return new URL(href)

  const secondQ = beforeFragment.indexOf('?', firstQ + 1)
  if (secondQ === -1) return new URL(href)

  const fixed = `${beforeFragment.slice(0, secondQ)}&${beforeFragment.slice(secondQ + 1)}${fragment}`
  return new URL(fixed)
}

/** True when `value` parses as an https URL, so it is safe to put in an `href`. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Returns an https URL the browser may be navigated to, or throws.
 *
 * The auth API's redirect is a response body, not a constant, and it is assigned
 * straight to `window.location.href`. A `javascript:` value there would run in
 * the application's own origin, so the scheme is checked the same way funding
 * links already are.
 */
/** Loopback hosts, where plaintext http never leaves the machine. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Returns a URL a bearer credential may be sent to, or throws.
 *
 * The encryption-session endpoint receives the user's access token in an
 * `Authorization` header. Over plain http that token crosses the network in
 * clear text, so only https is accepted — except on loopback, which local
 * development backends use.
 */
export function assertCredentialedEndpoint(value: string): string {
  let url: URL
  try {
    // A relative path resolves against the page itself (the firebase template
    // proxies `/api/...` through its dev server), so it never leaves the origin
    // the user is already on.
    url = new URL(value, globalThis.location?.href)
  } catch {
    throw new ValidationError('`createEncryptedSessionEndpoint` is not a valid URL.')
  }

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) {
    throw new ValidationError('`createEncryptedSessionEndpoint` must be https.', {
      details: `Refused to send the user's access token to a "${url.protocol}" URL on "${url.hostname}". Plain http is allowed only on localhost.`,
    })
  }

  return url.href
}

export function assertNavigableRedirect(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ValidationError('The authentication provider returned an unusable redirect URL.')
  }

  if (url.protocol !== 'https:') {
    throw new ValidationError('The authentication provider returned a redirect URL that is not https.', {
      details: `Refused to navigate to a "${url.protocol}" URL.`,
    })
  }

  return url.href
}
