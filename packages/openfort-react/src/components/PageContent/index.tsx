'use client'

import { useEffect } from 'react'
import { useSignOut } from '../../hooks/openfort/auth/useSignOut.js'
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
  header?: string
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
  const { setOnBack, setRoute, setPreviousRoute, setRouteHistory } = useOpenfort()
  const { signOut } = useSignOut()

  useEffect(() => {
    if (typeof onBack === 'string' || (onBack instanceof Object && typeof onBack !== 'function')) {
      switch (onBack) {
        case 'back':
          setOnBack(() => () => setPreviousRoute())
          break
        case 'inherit':
          break
        default:
          setOnBack(() => () => {
            if (logoutOnBack) signOut()
            setRoute(onBack)
          })
      }
    } else if (onBack) {
      if (logoutOnBack) {
        setOnBack(() => () => {
          signOut()
          onBack()
        })
      } else {
        setOnBack(() => onBack)
      }
    } else if (onBack === null) {
      setOnBack(null)
      // If null then clear history
      setRouteHistory((h) => {
        const last = h[h.length - 1]
        return last ? [last] : h
      })
    } else setOnBack(null)
  }, [!!onBack, !!logoutOnBack])

  return (
    <PageContentStyle className={className} style={{ width }}>
      {header && <ModalHeading>{header}</ModalHeading>}
      {children}
    </PageContentStyle>
  )
}
