/**
 * Utilities for secure handling of OAuth callback URLs containing tokens.
 *
 * Prevents Referer-header leakage of access tokens and provides robust
 * URL parsing for the OF-1013 workaround (duplicate `?` in redirect URLs).
 */

const REFERRER_META_ID = '__openfort_no_referrer'

/**
 * Injects a `<meta name="referrer" content="no-referrer">` tag so that
 * any subresource request fired before `history.replaceState` strips the
 * tokens will NOT leak the full URL (including access_token) via the
 * Referer header.
 *
 * Call this **synchronously** — before any `await` — when the URL
 * contains sensitive query parameters.
 *
 * @returns A cleanup function that removes the meta tag.
 */
export function suppressReferrer(): () => void {
  if (typeof document === 'undefined') return () => {}

  // Avoid duplicates if called more than once
  if (document.getElementById(REFERRER_META_ID)) return () => {}

  const meta = document.createElement('meta')
  meta.id = REFERRER_META_ID
  meta.name = 'referrer'
  meta.content = 'no-referrer'
  document.head.appendChild(meta)

  return () => {
    meta.remove()
  }
}

/**
 * Parses the current `window.location.href`, fixing the OF-1013 issue
 * where the server redirect produces a URL with a duplicate `?`, e.g.
 * `https://example.com/callback?existing=1?access_token=xxx&user_id=yyy`.
 *
 * Instead of a fragile `.replace('?access_token=', '&access_token=')`
 * that can mangle values containing the same substring, this finds the
 * *second* `?` (if any) and replaces it with `&`.
 */
export function parseCallbackUrl(href: string): URL {
  const firstQ = href.indexOf('?')
  if (firstQ === -1) return new URL(href)

  const secondQ = href.indexOf('?', firstQ + 1)
  if (secondQ === -1) return new URL(href)

  // Replace only the second `?` with `&`
  const fixed = `${href.slice(0, secondQ)}&${href.slice(secondQ + 1)}`
  return new URL(fixed)
}
