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
 * Parses callback URLs that contain a second query delimiter, such as
 * `https://example.com/callback?existing=1?access_token=xxx&user_id=yyy`.
 */
export function parseCallbackUrl(href: string): URL {
  const firstQ = href.indexOf('?')
  if (firstQ === -1) return new URL(href)

  const secondQ = href.indexOf('?', firstQ + 1)
  if (secondQ === -1) return new URL(href)

  const fixed = `${href.slice(0, secondQ)}&${href.slice(secondQ + 1)}`
  return new URL(fixed)
}
