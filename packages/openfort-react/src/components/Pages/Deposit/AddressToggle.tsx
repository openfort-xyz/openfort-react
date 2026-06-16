'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { chevron, detailsToggle } from './formStyles'
import { OrDivider } from './OrDivider'

type AddressToggleProps = {
  /** Label on the toggle row, e.g. "Or send to a deposit address". */
  label: string
  children: ReactNode
}

/**
 * An off-by-default disclosure that reveals the manual "transfer from address"
 * path beneath a tab's primary buttons. Collapsed by default so the one-tap
 * options lead.
 */
export function AddressToggle({ label, children }: AddressToggleProps) {
  const [open, setOpen] = useState(false)
  const { triggerResize } = useOpenfort()
  useEffect(() => {
    triggerResize()
  }, [open, triggerResize])

  return (
    <>
      <OrDivider />
      <button type="button" style={detailsToggle} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <span style={chevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open && children}
    </>
  )
}
