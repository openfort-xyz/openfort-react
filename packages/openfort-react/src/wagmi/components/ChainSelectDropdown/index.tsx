'use client'

import { AnimatePresence } from 'framer-motion'
import type React from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import useMeasure from 'react-use-measure'
import Portal from '../../../components/Common/Portal/index.js'
import { useThemeContext } from '../../../components/ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { useOpenfort } from '../../../components/Openfort/useOpenfort.js'
import FocusTrap from '../../../hooks/useFocusTrap.js'
import useLocales from '../../../hooks/useLocales.js'
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js'
import { ResetContainer } from '../../../styles/index.js'
import ChainSelectList from '../ChainSelectList/index.js'
import { DropdownContainer, DropdownHeading, DropdownOverlay, DropdownWindow } from './styles.js'

const FOCUSABLE_SELECTOR = `
  a[href]:not(:disabled),
  button:not(:disabled),
  textarea:not(:disabled),
  input[type="text"]:not(:disabled),
  input[type="radio"]:not(:disabled),
  input[type="checkbox"]:not(:disabled),
  select:not(:disabled)
`

const isDisabled = (element: Element): boolean =>
  (element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement) &&
  element.disabled

/**
 * Move focus to the enabled sibling of the active element in `direction`,
 * skipping disabled controls. Falls back to `wrapTo` at either end of the list.
 */
const focusSibling = (direction: 'previous' | 'next', wrapTo: HTMLElement) => {
  const step = (element: Element): Element | null =>
    direction === 'previous' ? element.previousElementSibling : element.nextElementSibling

  const active = document.activeElement
  let candidate = active ? step(active) : null
  while (candidate && isDisabled(candidate)) candidate = step(candidate)
  if (candidate instanceof HTMLElement) candidate.focus()
  else wrapTo.focus()
}

const ChainSelectDropdown: React.FC<{
  children?: React.ReactNode
  open: boolean
  onClose: () => void
  offsetX?: number
  offsetY?: number
}> = ({ children, open, onClose, offsetX = 0, offsetY = 8 }) => {
  const context = useOpenfort()
  const themeContext = useThemeContext()

  const locales = useLocales()

  const [offset, _setOffset] = useState({ x: 0, y: 0 })

  useLockBodyScroll(open)

  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') onClose()

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!contentRef.current) return
        e.preventDefault()

        const focusableEls = contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        const firstFocusableEl = focusableEls[0]
        const lastFocusableEl = focusableEls[focusableEls.length - 1]
        if (!firstFocusableEl || !lastFocusableEl) return

        if (e.key === 'ArrowUp') {
          if (document.activeElement === firstFocusableEl) lastFocusableEl.focus()
          else focusSibling('previous', lastFocusableEl)
        } else {
          if (document.activeElement === lastFocusableEl) firstFocusableEl.focus()
          else focusSibling('next', firstFocusableEl)
        }
      }
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [open, onClose])

  const targetRef = useRef<HTMLDivElement | null>(null)
  const [ref, bounds] = useMeasure({
    debounce: 120, // waits until modal transition has finished before measuring
    offsetSize: true,
    scroll: true,
  })

  // Pin the dropdown window just below the measured trigger.
  const refresh = useCallback(() => {
    if (
      !targetRef.current ||
      bounds.top + bounds.bottom + bounds.left + bounds.right + bounds.height + bounds.width === 0
    ) {
      return
    }

    const x = bounds.left + offsetX
    const y = bounds.top + bounds.height + offsetY

    targetRef.current.style.left = `${x}px`
    targetRef.current.style.top = `${y}px`
  }, [bounds, offsetX, offsetY])

  const innerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return
      targetRef.current = node
      refresh()
    },
    [refresh]
  )

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
  useIsomorphicLayoutEffect(refresh, [refresh, open])

  useEffect(() => {
    window.addEventListener('scroll', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('scroll', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <>
      <div ref={ref}>{children}</div>
      <AnimatePresence>
        {open && (
          <Portal>
            <ResetContainer
              $useTheme={themeContext.theme ?? context.uiConfig.theme}
              $useMode={themeContext.mode ?? context.mode}
              $customTheme={themeContext.customTheme ?? themeContext.customTheme}
            >
              <FocusTrap>
                <DropdownWindow ref={contentRef}>
                  <DropdownOverlay onClick={onClose} />
                  <DropdownContainer
                    ref={innerRef}
                    style={{
                      left: offset.x,
                      top: offset.y,
                    }}
                    initial={'collapsed'}
                    animate={'open'}
                    exit={'collapsed'}
                    variants={{
                      collapsed: {
                        transformOrigin: '0 0',
                        opacity: 0,
                        scale: 0.96,
                        z: 0.01,
                        y: -4,
                        x: 0,
                        transition: {
                          duration: 0.1,
                        },
                      },
                      open: {
                        transformOrigin: '0 0',
                        willChange: 'opacity,transform',
                        opacity: 1,
                        scale: 1,
                        z: 0.01,
                        y: 0,
                        x: 0,
                        transition: {
                          ease: [0.76, 0, 0.24, 1],
                          duration: 0.15,
                        },
                      },
                    }}
                  >
                    <DropdownHeading>{locales.switchNetworks}</DropdownHeading>
                    <ChainSelectList />
                  </DropdownContainer>
                </DropdownWindow>
              </FocusTrap>
            </ResetContainer>
          </Portal>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChainSelectDropdown
