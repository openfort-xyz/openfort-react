'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSignOut } from '../../hooks/openfort/auth/useSignOut.js'
import { usePageActivity } from '../Common/Modal/pageActivity.js'
import { ModalHeading } from '../Common/Modal/styles.js'
import type { SetRouteOptions } from '../Openfort/types.js'
import { useOpenfort } from '../Openfort/useOpenfort.js'
import { PageContentStyle } from './styles.js'

export type SetOnBackFunction = (() => void) | null | 'inherit' | 'back' | SetRouteOptions

type PageContentProps = {
  children?: React.ReactNode
  width?: number | string
  onBack?: SetOnBackFunction
  logoutOnBack?: boolean
  header?: React.ReactNode
  className?: string
}

export const PageContent = ({
  children,
  width,
  onBack = 'back',
  logoutOnBack,
  header,
  className,
}: PageContentProps) => {
  const pageActive = usePageActivity()
  const { setOnBack, setRoute, setPreviousRoute, setRouteHistory } = useOpenfort()
  const { signOut } = useSignOut()

  // Pages commonly pass an inline `onBack` closure, so the registered handler resolves its inputs
  // from this ref when the user actually presses back. That keeps `handleBack` referentially
  // stable — the effect below can register it without re-running on every render — while still
  // running the latest closure rather than the one from the render that registered it.
  const latestRef = useRef({ onBack, logoutOnBack, signOut, setRoute, setPreviousRoute })
  useEffect(() => {
    latestRef.current = { onBack, logoutOnBack, signOut, setRoute, setPreviousRoute }
  })

  // 'back' walks the route history and never signs out; every other target honours logoutOnBack.
  const handleBack = useCallback(() => {
    const current = latestRef.current
    if (current.onBack === 'back') {
      current.setPreviousRoute()
      return
    }
    if (current.logoutOnBack) current.signOut()
    if (typeof current.onBack === 'function') current.onBack()
    else if (current.onBack && current.onBack !== 'inherit') current.setRoute(current.onBack)
  }, [])

  // 'inherit' leaves whatever the parent registered in place; an explicit null both clears the
  // handler and trims the history so the page becomes a new starting point.
  const backMode = onBack === 'inherit' ? 'inherit' : onBack === null ? 'clear-history' : onBack ? 'handle' : 'clear'

  useEffect(() => {
    if (!pageActive) return
    switch (backMode) {
      case 'inherit':
        break
      case 'handle':
        setOnBack(() => handleBack)
        break
      case 'clear-history':
        setOnBack(null)
        setRouteHistory((h) => {
          const last = h[h.length - 1]
          return last ? [last] : h
        })
        break
      default:
        setOnBack(null)
    }
  }, [pageActive, backMode, handleBack, setOnBack, setRouteHistory])

  return (
    <PageContentStyle className={className} style={{ width }}>
      {header && <ModalHeading>{header}</ModalHeading>}
      {children}
    </PageContentStyle>
  )
}
