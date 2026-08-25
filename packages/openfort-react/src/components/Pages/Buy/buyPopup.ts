const POPUP_NAME = 'BuyPopup'
const POPUP_WIDTH = 500
const POPUP_HEIGHT = 700

// Held outside React: a WindowProxy is imperative handle state, and parking it in
// context/state would re-render the tree every time the popup is opened or cleared.
let pendingPopup: Window | null = null

const isUsable = (popup: Window | null): popup is Window => !!popup && !popup.closed

export const buyPopupFeatures = (): string => {
  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height
  const left = width / 2 - POPUP_WIDTH / 2 + dualScreenLeft
  const top = height / 2 - POPUP_HEIGHT / 2 + dualScreenTop

  return `scrollbars=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},top=${top},left=${left}`
}

/**
 * Opens the provider window while the browser's transient user activation is still
 * live. Browsers only honour `window.open` for a short window after the originating
 * click — roughly 0.5s in Safari, 1s in Chrome and Firefox — and creating an onramp
 * session takes longer than that, so opening the window after the `await` gets it
 * blocked and `window.open` returns null. Reserve it up front on `about:blank` and
 * point it at the provider once the session resolves.
 *
 * Must be called synchronously from a user gesture handler.
 */
export const reserveBuyPopup = (): Window | null => {
  if (typeof window === 'undefined') return null

  closeBuyPopup()
  const popup = window.open('', POPUP_NAME, buyPopupFeatures())

  if (popup) {
    try {
      // about:blank inherits the opener's origin, so this is same-origin until we
      // navigate to the provider. Purely cosmetic — never block the flow on it.
      popup.document.write('<!doctype html><title>Connecting…</title>')
      popup.document.close()
    } catch {
      // Ignore: some browsers restrict writing to about:blank.
    }
  }

  pendingPopup = popup
  return popup
}

/** Hands the reserved window to the caller, which becomes responsible for it. */
export const takeBuyPopup = (): Window | null => {
  const popup = pendingPopup
  pendingPopup = null
  return isUsable(popup) ? popup : null
}

export const closeBuyPopup = (): void => {
  if (isUsable(pendingPopup)) pendingPopup.close()
  pendingPopup = null
}

/**
 * Navigates an already-open window to the provider. Cross-origin navigation of a
 * window you opened is allowed (reading its location later is not), but a window
 * closed by the user in the meantime will throw.
 */
export const navigateBuyPopup = (popup: Window, url: string): boolean => {
  try {
    popup.location.href = url
    return true
  } catch {
    return false
  }
}
