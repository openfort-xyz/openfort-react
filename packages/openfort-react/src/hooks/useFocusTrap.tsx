'use client'

// Based on https://hiddedevries.nl/en/blog/2017-01-29-using-javascript-to-trap-focus-in-an-element

import type React from 'react'
import { useCallback, useEffect, useRef } from 'react'

const KEYCODE_TAB = 9

function useFocusTrap() {
  const elRef = useRef<HTMLDivElement | null>(null)

  const handleFocus = useCallback((e: KeyboardEvent) => {
    if (!elRef.current) return
    // The outgoing page renders before the incoming one and is made inert while
    // it animates out, so without the `[inert]` exclusion the first match is a
    // control that cannot take focus: `.focus()` no-ops while `preventDefault()`
    // still runs, and the Tab is swallowed.
    var focusableEls = Array.from(
        elRef.current.querySelectorAll<HTMLElement>(`
        a[href]:not(:disabled),
        button:not(:disabled),
        textarea:not(:disabled),
        input[type="text"]:not(:disabled),
        input[type="radio"]:not(:disabled),
        input[type="checkbox"]:not(:disabled),
        select:not(:disabled)
      `)
      ).filter((el) => !el.closest('[inert]')),
      firstFocusableEl = focusableEls[0],
      lastFocusableEl = focusableEls[focusableEls.length - 1]

    var isTabPressed = e.key === 'Tab' || e.keyCode === KEYCODE_TAB

    if (!isTabPressed) {
      return
    }

    if (e.shiftKey) {
      /* shift + tab */ if (document.activeElement === firstFocusableEl) {
        lastFocusableEl?.focus()
        e.preventDefault()
      }
    } /* tab */ else {
      if (document.activeElement === lastFocusableEl) {
        firstFocusableEl?.focus()
        e.preventDefault()
      }
    }
  }, [])

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    el.addEventListener('keydown', handleFocus)
    el.focus({ preventScroll: true })
    return () => {
      el.removeEventListener('keydown', handleFocus)
    }
  }, [handleFocus])

  return elRef
}

export default function FocusTrap(props: { children?: React.ReactNode }) {
  const elRef = useFocusTrap()

  return <div ref={elRef}>{props.children}</div>
}
