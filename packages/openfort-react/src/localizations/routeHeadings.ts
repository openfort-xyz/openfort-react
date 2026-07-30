import { routes } from '../components/Openfort/types.js'
import { isWalletConnectConnector } from '../utils/index.js'
import type { LocaleProps } from './locales/index.js'

/** The connector a connect-route heading describes, if one has been picked. */
type HeadingConnector = {
  name?: string
  connectorId?: string
  /** The connect screen shows a QR code rather than the injected-wallet flow. */
  showsQrCode: boolean
}

/**
 * Title shown in the modal header for a route. Routes with no title return an
 * empty string, which renders the header bar without text.
 *
 * @param route Current route id.
 * @param locales Translations for the active language.
 * @param connector Connector the connect route is talking about.
 */
export function getRouteHeading(route: string, locales: LocaleProps, connector: HeadingConnector): string {
  switch (route) {
    case routes.ABOUT:
      return locales.aboutScreen_heading
    case routes.EMAIL_LOGIN:
      return locales.emailLoginScreen_heading
    case routes.FORGOT_PASSWORD:
      return locales.forgotPasswordScreen_heading
    case routes.EMAIL_VERIFICATION:
      return locales.emailVerificationScreen_heading
    case routes.CONNECT:
      if (!connector.showsQrCode) return connector.name ?? ''
      return isWalletConnectConnector(connector.connectorId)
        ? locales.scanScreen_heading
        : locales.scanScreen_heading_withConnector
    case routes.CONNECTORS:
      return locales.connectorsScreen_heading
    case routes.MOBILECONNECTORS:
      return locales.mobileConnectorsScreen_heading
    case routes.DOWNLOAD:
      return locales.downloadAppScreen_heading
    case routes.ONBOARDING:
      return locales.onboardingScreen_heading
    case routes.SWITCHNETWORKS:
    case routes.ETH_SWITCH_NETWORK:
      return locales.switchNetworkScreen_heading
    case routes.SIGN_MESSAGE:
      return locales.signMessageScreen_heading
    default:
      return ''
  }
}
