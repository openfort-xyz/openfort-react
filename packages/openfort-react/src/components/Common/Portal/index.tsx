'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { OPENFORT_VERSION } from '../../../version'

const Portal = ({ selector = '__OPENFORT__', children }: { selector?: string; children?: React.ReactNode }) => {
  const ref = useRef<Element | null>(null)
  const [mounted, setMounted] = useState<boolean>(false)

  useEffect(() => {
    const selectorPrefixed = `#${selector.replace(/^#/, '')}`
    ref.current = document.querySelector(selectorPrefixed)

    if (!ref.current) {
      const div = document.createElement('div')
      div.setAttribute('id', selector)
      div.setAttribute('data-openfort-react', `${OPENFORT_VERSION}`)
      document.body.appendChild(div)
      ref.current = div
    }

    setMounted(true)
  }, [selector])

  if (!ref.current) return null
  return mounted ? createPortal(children, ref.current) : null
}

export default Portal
