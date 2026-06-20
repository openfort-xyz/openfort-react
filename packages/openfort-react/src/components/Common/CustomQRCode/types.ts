import type React from 'react'

export type CustomQRCodeProps = {
  value?: string
  image?: React.ReactNode
  imageBackground?: string
  /** When false, the center logo isn't clipped to the rounded square (lets a badge overflow). Default true. */
  imageClip?: boolean
  imagePosition?: 'center' | 'bottom right'
  tooltipMessage?: React.ReactNode | string
}
