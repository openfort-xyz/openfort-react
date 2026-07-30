import { describe, expect, it } from 'vitest'
import { routes } from '../components/Openfort/types.js'
import enUS from '../localizations/locales/en-US.js'
import { getRouteHeading } from '../localizations/routeHeadings.js'

const noConnector = { showsQrCode: false }

describe('getRouteHeading', () => {
  it('translates the routes that carry a title', () => {
    expect(getRouteHeading(routes.ABOUT, enUS, noConnector)).toBe(enUS.aboutScreen_heading)
    expect(getRouteHeading(routes.EMAIL_LOGIN, enUS, noConnector)).toBe(enUS.emailLoginScreen_heading)
    expect(getRouteHeading(routes.FORGOT_PASSWORD, enUS, noConnector)).toBe(enUS.forgotPasswordScreen_heading)
    expect(getRouteHeading(routes.EMAIL_VERIFICATION, enUS, noConnector)).toBe(enUS.emailVerificationScreen_heading)
    expect(getRouteHeading(routes.SIGN_MESSAGE, enUS, noConnector)).toBe(enUS.signMessageScreen_heading)
    expect(getRouteHeading(routes.ETH_SWITCH_NETWORK, enUS, noConnector)).toBe(enUS.switchNetworkScreen_heading)
  })

  it('falls back to an empty title for routes that have none', () => {
    expect(getRouteHeading(routes.PROFILE, enUS, noConnector)).toBe('')
    expect(getRouteHeading('notARoute', enUS, noConnector)).toBe('')
  })

  it('names the connector on the connect route when it uses the injector flow', () => {
    expect(getRouteHeading(routes.CONNECT, enUS, { name: 'MetaMask', showsQrCode: false })).toBe('MetaMask')
  })

  it('asks for a scan on the connect route when it shows a QR code', () => {
    expect(getRouteHeading(routes.CONNECT, enUS, { connectorId: 'walletConnect', showsQrCode: true })).toBe(
      enUS.scanScreen_heading
    )
    expect(getRouteHeading(routes.CONNECT, enUS, { connectorId: 'metaMask', showsQrCode: true })).toBe(
      enUS.scanScreen_heading_withConnector
    )
  })
})
