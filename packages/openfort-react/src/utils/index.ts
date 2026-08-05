import { detect } from 'detect-browser'
import React from 'react'
import { formatWithDynamicDecimals } from '../components/Pages/Buy/utils.js'
import { truncateEthAddress, truncateSolanaAddress } from './format.js'

/**
 * Renders a balance for display: full precision below 10,000, compact above it.
 *
 * The suffix is lower-cased because that is how this SDK has always rendered it
 * (`1.5k`, not `1.5K`). Above 1e15 `Intl` keeps scaling `t` rather than moving
 * to `p`/`e`, so a quadrillion reads `1000t` — closer to what a reader can
 * actually parse than a peta prefix.
 */
const nFormatter = (num: number, digits: number = 2) => {
  // Handle zero case
  if (num === 0) return '0.00'

  // Handle very small amounts
  if (num > 0 && num < 0.000001) return '<0.000001'

  if (num < 10000) return formatWithDynamicDecimals(num)

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  })
    .format(num)
    .toLowerCase()
}

const detectBrowser = () => {
  const browser = detect()
  return browser?.name ?? ''
}
const detectOS = () => {
  const browser = detect()
  return browser?.os ?? ''
}

const isIOS = () => {
  const os = detectOS()
  return os.toLowerCase().includes('ios')
}
const isAndroid = () => {
  const os = detectOS()
  return os.toLowerCase().includes('android')
}
const isMobile = () => {
  return isAndroid() || isIOS()
}

type ReactChildArray = ReturnType<typeof React.Children.toArray>
function flattenChildren(children: React.ReactNode): ReactChildArray {
  const childrenArray = React.Children.toArray(children)
  return childrenArray.reduce((flatChildren: ReactChildArray, child) => {
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment) {
      return flatChildren.concat(flattenChildren(child.props.children))
    }
    flatChildren.push(child)
    return flatChildren
  }, [])
}

export const isWalletConnectConnector = (connectorId?: string) => connectorId === 'walletConnect'

export const isCoinbaseWalletConnector = (connectorId?: string) => connectorId === 'coinbaseWalletSDK'

export const isInjectedConnector = (connectorId?: string) => connectorId === 'injected'

export {
  detectBrowser,
  flattenChildren,
  isAndroid,
  isIOS,
  isMobile,
  nFormatter,
  truncateEthAddress,
  truncateSolanaAddress,
}
