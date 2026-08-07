import type { OpenfortSDKConfiguration } from '@openfort/openfort-js'
import type { OpenfortError } from './errors/index.js'
import type { Languages as Lang } from './localizations/index.js'
import type { CustomTheme } from './styles/customTheme.js'

export type { CustomTheme }
export type Languages = Lang

export type Theme = 'auto' | 'web95' | 'retro' | 'soft' | 'midnight' | 'minimal' | 'rounded' | 'nouns'
export type Mode = 'light' | 'dark' | 'auto'

export type All = {
  theme?: Theme
  mode?: Mode
  customTheme?: CustomTheme
  lang?: Languages
}

/** Props for custom avatar rendering (e.g. custom image component). */
export type CustomAvatarProps = {
  address?: string | undefined
  ensName?: string | undefined
  ensImage?: string
  size: number
  radius: number
}

export { OpenfortError } from './errors/index.js'

/**
 * Callbacks accepted by every Openfort action hook, at the hook level and again
 * per call.
 *
 * Actions never reject: a failure runs `onError` and resolves to `{ error }`, so
 * a call site can branch on the result without a try/catch.
 */
export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void
  onError?: (error: OpenfortError) => void
}

// Re-export important types and enums from openfort-js
export type SDKOverrides = NonNullable<OpenfortSDKConfiguration['overrides']>
export { OAuthProvider, ThirdPartyOAuthProvider } from '@openfort/openfort-js'
