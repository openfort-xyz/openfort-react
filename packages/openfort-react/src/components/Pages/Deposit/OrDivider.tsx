'use client'

import { orLine, orRow, orText } from './formStyles.js'

/** Separates the scan-QR / copy-address path from the open-wallet / open-exchange path. */
export function OrDivider() {
  return (
    <div style={orRow}>
      <span style={orLine} />
      <span style={orText}>or</span>
      <span style={orLine} />
    </div>
  )
}
