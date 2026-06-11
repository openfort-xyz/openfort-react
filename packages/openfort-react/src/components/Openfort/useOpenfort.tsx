'use client'

import React from 'react'
import { OpenfortContext } from './context'

export const useOpenfort = () => {
  const context = React.useContext(OpenfortContext)
  if (!context) throw Error('Openfort Hook must be inside a Provider.')
  return context
}

/** Alias used by sub-path bundles to avoid naming collision with the public useOpenfort (useOpenfortCore). */
export { useOpenfort as useOpenfortUIContext }
