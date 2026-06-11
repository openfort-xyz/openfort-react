import { OPENFORT_VERSION } from '../version'

// SVG logo via background-image data URI is supported in Chrome/Firefox if desired later.
let _shown = false

export function showInitBanner(): void {
  if (_shown || process.env.NODE_ENV === 'production') return
  _shown = true
  // biome-ignore lint/suspicious/noConsole: intentional SDK init banner
  console.log(
    `%c \uD83D\uDCE6 Openfort React SDK %c v${OPENFORT_VERSION} %c \u2197 openfort.io/docs`,
    'background:#0f0f0f;color:#fff;padding:2px 6px;border-radius:4px 0 0 4px;font-weight:600',
    'background:#333;color:#aaa;padding:2px 6px;border-radius:0 4px 4px 0',
    'color:#888;padding:2px 4px'
  )
}
