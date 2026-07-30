import React from 'react'
import browsers from '../../../assets/browsers.js'
import { detectBrowser } from '../../../utils/index.js'
import { BrowserIconContainer } from './styles.js'
import type { BrowserIconProps } from './types.js'

const BrowserIcon = React.forwardRef(({ browser }: BrowserIconProps, _ref: React.Ref<HTMLElement>) => {
  const currentBrowser = browser ?? detectBrowser()

  let icon: React.ReactNode | undefined
  switch (currentBrowser) {
    case 'chrome':
      icon = browsers.Chrome
      break
    case 'firefox':
      icon = browsers.FireFox
      break
    case 'edge':
      icon = browsers.Edge
      break
    case 'brave':
      //   icon = browsers.Brave;
      break
  }
  if (!icon) return null
  return <BrowserIconContainer>{icon}</BrowserIconContainer>
})
BrowserIcon.displayName = 'BrowserIcon'

export default BrowserIcon
