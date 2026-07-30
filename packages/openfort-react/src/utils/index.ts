import { detect } from 'detect-browser'
import React from 'react'
import { formatWithDynamicDecimals } from '../components/Pages/Buy/utils'
import { truncateEthAddress, truncateSolanaAddress } from './format'

const nFormatter = (num: number, digits: number = 2) => {
  // Handle zero case
  if (num === 0) return '0.00'

  // Handle very small amounts
  if (num > 0 && num < 0.000001) return '<0.000001'

  if (num < 10000) return formatWithDynamicDecimals(num)
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'k' },
    { value: 1e6, symbol: 'm' },
    { value: 1e9, symbol: 'b' },
    { value: 1e12, symbol: 't' },
    { value: 1e15, symbol: 'p' },
    { value: 1e18, symbol: 'e' },
  ]

  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
  var item = lookup
    .slice()
    .reverse()
    .find((item) => num >= item.value)
  return item ? (num / item.value).toFixed(digits).replace(rx, '$1') + item.symbol : '0'
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
