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

/** Props for custom avatar rendering (e.g. custom image component). */
export type CustomAvatarProps = {
  address?: string | undefined
  ensName?: string | undefined
  ensImage?: string
  size: number
  radius: number
}

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

export class OpenfortError extends Error {
  type: OpenfortReactErrorType
  data: OpenfortErrorData

  constructor(message: string, type: OpenfortReactErrorType, data?: OpenfortErrorData) {
    if (data?.error instanceof OpenfortError) {
      super(data.error.message)
      this.data = Object.freeze(data.error.data)
      this.type = data.error.type
      this.name = data.error.name
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
  }
}

export type OpenfortHookOptions<T = { error?: OpenfortError }> = {
  onSuccess?: (data: T) => void
  onError?: (error: OpenfortError) => void
  throwOnError?: boolean
}

// Re-export important types and enums from openfort-js
export type { SDKOverrides } from '@openfort/openfort-js'
export { OAuthProvider, ThirdPartyOAuthProvider } from '@openfort/openfort-js'
