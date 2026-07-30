'use client'

import { AnimatePresence, motion } from 'framer-motion'
import useWindowSize from '../../../hooks/useWindowSize.js'

import Tooltip from '../Tooltip/index.js'
import { QRCode } from './QRCode.js'
import { LogoContainer, LogoIcon, QRCodeContainer, QRCodeContent, QRPlaceholder } from './styles.js'
import type { CustomQRCodeProps } from './types.js'

function CustomQRCode({
  value,
  image,
  imageBackground,
  imageClip = true,
  imagePosition = 'center',
  tooltipMessage,
}: CustomQRCodeProps) {
  const windowSize = useWindowSize()

  const Logo =
    windowSize.width > 920 && tooltipMessage ? (
      <Tooltip xOffset={139} yOffset={5} delay={0.1} message={tooltipMessage}>
        {image}
      </Tooltip>
    ) : (
      image
    )

  return (
    <QRCodeContainer>
      <QRCodeContent>
        {image && (
          <LogoContainer>
            <LogoIcon
              $wcLogo={imagePosition !== 'center'}
              $clip={imageClip}
              style={{
                background: imagePosition === 'center' ? imageBackground : undefined,
              }}
            >
              {Logo}
            </LogoIcon>
          </LogoContainer>
        )}

        <AnimatePresence initial={false}>
          {value ? (
            <motion.div
              key={value}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, position: 'absolute', inset: [0, 0] }}
              transition={{
                duration: 0.2,
              }}
            >
              <QRCode uri={value} size={288} ecl="H" clearArea={!!(imagePosition === 'center' && image)} />
            </motion.div>
          ) : (
            <QRPlaceholder
              initial={{ opacity: 0.1 }}
              animate={{ opacity: 0.1 }}
              exit={{ opacity: 0, position: 'absolute', inset: [0, 0] }}
              transition={{
                duration: 0.2,
              }}
            >
              <span />
              <span />
              <span />
              <div />
            </QRPlaceholder>
          )}
        </AnimatePresence>
      </QRCodeContent>
    </QRCodeContainer>
  )
}
CustomQRCode.displayName = 'CustomQRCode'

export default CustomQRCode
