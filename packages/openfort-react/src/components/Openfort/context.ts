'use client'

import type { ChainTypeEnum, OAuthProvider, SDKOverrides, ThirdPartyAuthConfiguration } from '@openfort/openfort-js'
import type React from 'react'
import { createContext } from 'react'
import type { Chain } from 'viem'
import type { useConnectCallbackProps } from '../../openfort/connectCallbackTypes'
import type { CustomTheme, Languages, Mode, Theme } from '../../types'
import type {
  BuyFormState,
  DebugModeOptions,
  OpenfortUIOptionsExtended,
  OpenfortWalletConfig,
  RouteOptions,
  SendFormState,
  SetRouteOptions,
} from './types'

type Connector =
  | {
      id: string
      type?: 'wallet'
    }
  | {
      id: OAuthProvider
      type: 'oauth'
    }

export type ContextValue = {
  chainType: ChainTypeEnum
  setChainType: (chainType: ChainTypeEnum) => void
  setTheme: React.Dispatch<React.SetStateAction<Theme>>
  mode: Mode
  setMode: React.Dispatch<React.SetStateAction<Mode>>
  setCustomTheme: React.Dispatch<React.SetStateAction<CustomTheme | undefined>>
  lang: Languages
  setLang: React.Dispatch<React.SetStateAction<Languages>>
  open: boolean
  setOpen: (value: boolean) => void
  route: RouteOptions
  setRoute: (options: SetRouteOptions) => void
  onBack: (() => void) | null
  setOnBack: React.Dispatch<React.SetStateAction<(() => void) | null>>
  headerLeftSlot: React.ReactNode | null
  setHeaderLeftSlot: React.Dispatch<React.SetStateAction<React.ReactNode | null>>

  previousRoute: RouteOptions | null
  setPreviousRoute: () => void
  routeHistory: RouteOptions[]
  setRouteHistory: React.Dispatch<React.SetStateAction<RouteOptions[]>>
  connector: Connector
  setConnector: React.Dispatch<React.SetStateAction<Connector>>
  debugMode: Required<DebugModeOptions>
  resize: number
  triggerResize: () => void
  publishableKey: string
  uiConfig: OpenfortUIOptionsExtended
  walletConfig?: OpenfortWalletConfig
  overrides?: SDKOverrides
  thirdPartyAuth?: ThirdPartyAuthConfiguration

  emailInput: string
  setEmailInput: React.Dispatch<React.SetStateAction<string>>

  phoneInput: string
  setPhoneInput: React.Dispatch<React.SetStateAction<string>>

  sendForm: SendFormState
  setSendForm: React.Dispatch<React.SetStateAction<SendFormState>>
  buyForm: BuyFormState
  setBuyForm: React.Dispatch<React.SetStateAction<BuyFormState>>

  /** Configured EVM chains (from wagmi bridge or walletConfig.ethereum). Empty when not EVM. */
  chains: Chain[]
} & useConnectCallbackProps

export const OpenfortContext = createContext<ContextValue | null>(null)

/**
 * UI context value for modal control, navigation, and theme management.
 * This is an internal context used by OpenfortProvider.
 */
export interface UIContextValue {
  // Modal control
  /** Whether the modal is open */
  isOpen: boolean
  /** Open the modal */
  openModal: () => void
  /** Close the modal */
  closeModal: () => void

  // Navigation
  /** Current route in the modal */
  currentRoute: RouteOptions
  /** Navigate to a new route */
  navigate: (route: SetRouteOptions) => void
  /** Go back to the previous route */
  goBack: () => void
  /** Route history stack */
  routeHistory: RouteOptions[]

  // Theme
  /** Current theme */
  theme: Theme
  /** Current color mode */
  mode: Mode
  /** Update theme */
  setTheme: (theme: Theme) => void
  /** Update color mode */
  setMode: (mode: Mode) => void

  // Forms (send/buy state)
  /** Form states */
  forms: {
    send: SendFormState
    buy: BuyFormState
  }
  /** Update send form state */
  updateSendForm: (updates: Partial<SendFormState>) => void
  /** Update buy form state */
  updateBuyForm: (updates: Partial<BuyFormState>) => void

  // Resize trigger (for layout adjustments)
  /** Trigger a resize calculation */
  triggerResize: () => void
}

export const UIContext = createContext<UIContextValue | null>(null)
