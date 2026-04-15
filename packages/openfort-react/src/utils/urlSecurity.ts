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

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Returns the URL if it uses a safe protocol (`http:`, `https:`, `mailto:`),
 * otherwise returns `undefined`.
 *
 * Use for any `href`/`src` attribute that takes a URL from untrusted
 * sources (SDK config, connector metadata, ENS records, server responses).
 * Blocks `javascript:`, `data:`, `vbscript:`, `file:` and other
 * script-bearing schemes that can escalate to XSS.
 *
 * Relative URLs are resolved against `window.location.origin` and
 * allowed as `http(s):`.
 *
 * @example
 * ```tsx
 * <a href={safeExternalHref(userProvidedUrl)} target="_blank" rel="noopener noreferrer" />
 * ```
 */
export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    const u = new URL(url, base)
    return SAFE_PROTOCOLS.has(u.protocol) ? u.toString() : undefined
  } catch {
    return undefined
  }
}

const IMG_DATA_URL_RE = /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,/i

/**
 * Returns the URL if it is a safe image source.
 *
 * Accepts `http(s):` and narrowly whitelisted `data:image/...;base64` URLs.
 * Rejects `javascript:`, raw `data:`, and other schemes. SVG data URLs are
 * allowed but callers rendering them as `<img>` are safe because the
 * browser blocks script execution inside `<img src>`.
 *
 * Primarily intended for ENS avatars and other user-influenced image
 * sources where a malicious record could attempt XSS via the `src`.
 */
export function safeImageSrc(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  if (IMG_DATA_URL_RE.test(url)) return url
  return safeExternalHref(url)
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
