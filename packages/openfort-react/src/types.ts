import type { Languages as Lang } from './localizations'
import type { CustomTheme } from './styles/customTheme'

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

export type { CustomAvatarProps } from './components/Common/Avatar'
export type {
  ConnectUIOptions as OpenfortOptions,
  OpenfortWalletConfig,
  PhoneConfig,
} from './components/Openfort/types'

export enum OpenfortReactErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  WALLET_ERROR = 'WALLET_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
}

interface OpenfortErrorData {
  [key: string]: unknown
}

/** Optional, actionable metadata attached to an {@link OpenfortError}. */
export interface OpenfortErrorOptions {
  /** Stable machine-readable code (see {@link ERROR_CODES}) a consumer can switch on. */
  code?: string
  /** Human-readable next step to resolve the error. */
  suggestion?: string
  /** Link to the relevant documentation. */
  docsUrl?: string
}

export class OpenfortError extends Error {
  type: OpenfortReactErrorType
  data: OpenfortErrorData
  readonly code?: string
  readonly suggestion?: string
  readonly docsUrl?: string

  constructor(message: string, type: OpenfortReactErrorType, data?: OpenfortErrorData, options?: OpenfortErrorOptions) {
    if (data?.error instanceof OpenfortError) {
      super(data.error.message)
      this.data = Object.freeze(data.error.data)
      this.type = data.error.type
      this.name = data.error.name
      // Preserve the wrapped error's actionable metadata; this call may override it.
      this.code = options?.code ?? data.error.code
      this.suggestion = options?.suggestion ?? data.error.suggestion
      this.docsUrl = options?.docsUrl ?? data.error.docsUrl
      return
    }
    if (data?.error instanceof Error) {
      super(data.error.message)
    } else {
      super(message)
    }
    this.type = type
    this.data = Object.freeze(data ?? {})
    this.name = 'OpenfortError'
    this.code = options?.code
    this.suggestion = options?.suggestion
    this.docsUrl = options?.docsUrl
  }
}

const DOCS_URL = 'https://www.openfort.io/docs/products/embedded-wallet/react'

/**
 * Registry of stable error codes with actionable messages. Use {@link createOpenfortError}
 * to construct an {@link OpenfortError} from a code so the message, suggestion, and docs
 * link stay consistent across throw sites.
 */
export const ERROR_CODES = {
  WALLET_CONFIG_MISSING: {
    type: OpenfortReactErrorType.CONFIGURATION_ERROR,
    message: 'Embedded wallet config not found.',
    suggestion: 'Pass walletConfig.shieldPublishableKey to OpenfortProvider so the embedded wallet can be configured.',
    docsUrl: DOCS_URL,
  },
  PROVIDER_NOT_READY: {
    type: OpenfortReactErrorType.WALLET_ERROR,
    message: 'Embedded wallet provider is not ready yet.',
    suggestion: 'Wait until useUser().isConnected is true before requesting the provider.',
    docsUrl: DOCS_URL,
  },
  NOT_AUTHENTICATED: {
    type: OpenfortReactErrorType.AUTHENTICATION_ERROR,
    message: 'No authenticated user.',
    suggestion: 'Sign the user in (e.g. useEmailAuth / useOAuth) before calling this.',
    docsUrl: DOCS_URL,
  },
} satisfies Record<string, { type: OpenfortReactErrorType; message: string; suggestion?: string; docsUrl?: string }>

/** Builds an {@link OpenfortError} from a registered {@link ERROR_CODES} entry. */
export function createOpenfortError(code: keyof typeof ERROR_CODES, dataOverrides?: OpenfortErrorData): OpenfortError {
  const entry = ERROR_CODES[code]
  return new OpenfortError(entry.message, entry.type, dataOverrides, {
    code,
    suggestion: entry.suggestion,
    docsUrl: entry.docsUrl,
  })
}

export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void
  onError?: (error: OpenfortError) => void
  throwOnError?: boolean
}

// Re-export important types and enums from openfort-js
export {
  OAuthProvider,
  SDKOverrides,
  ThirdPartyOAuthProvider,
} from '@openfort/openfort-js'
