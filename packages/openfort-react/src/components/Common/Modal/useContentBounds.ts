'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ResizeObserver from 'resize-observer-polyfill'

/** How long pointer input stays blocked after a page swap, covering its animation. */
const transitionBlockMs = 360

type Dimensions = { width: string | undefined; height: string | undefined }

const unmeasured: Dimensions = { width: undefined, height: undefined }

/**
 * Measures the active page so the modal can animate between page sizes.
 *
 * The returned ref goes on the element holding the page's content. Attaching it
 * starts a fresh measurement, observes the element for later size changes, and
 * blocks pointer input for the length of the page transition.
 *
 * @param retriggers Values whose change means the content box may have moved
 *   without the element itself changing — a chain switch, a viewport-class
 *   change, or an explicit resize request. Pass the same number of values on
 *   every render.
 * @returns The measured box, a callback ref for the content element, whether a
 *   transition is in flight, and resets for the modal's open/close edges.
 */
export function useContentBounds(retriggers: readonly unknown[]) {
  const [dimensions, setDimensions] = useState<Dimensions>(unmeasured)
  const [inTransition, setInTransition] = useState<boolean | undefined>(undefined)

  const nodeRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  // Held in a ref so a page swap during the block window cancels the pending timer.
  const blockTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Re-measuring is cheap and happens on every resize notification, so keep the
  // previous state object when nothing moved.
  const updateBounds = useCallback((node: HTMLElement) => {
    const width = `${node.offsetWidth}px`
    const height = `${node.offsetHeight}px`
    setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
  }, [])

  const contentRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node) {
        nodeRef.current = null
        observerRef.current?.disconnect()
        observerRef.current = null
        clearTimeout(blockTimeoutRef.current)
        blockTimeoutRef.current = undefined
        setInTransition(false)
        return
      }
      nodeRef.current = node

      setInTransition((current) => current !== undefined)
      clearTimeout(blockTimeoutRef.current)
      blockTimeoutRef.current = setTimeout(() => setInTransition(false), transitionBlockMs)

      updateBounds(node)

      // Auto-fit: re-measure whenever the active page's content size changes, so
      // every page — and any new one — sizes the modal correctly without having
      // to call triggerResize() itself.
      observerRef.current?.disconnect()
      const observer = new ResizeObserver(() => {
        if (nodeRef.current === node) updateBounds(node)
      })
      observer.observe(node)
      observerRef.current = observer
    },
    [updateBounds]
  )

  // `retriggers` are triggers rather than inputs: the effect re-reads the same
  // node, it just needs to know one of them moved.
  useEffect(() => {
    if (nodeRef.current) updateBounds(nodeRef.current)
  }, [...retriggers, updateBounds])

  useEffect(
    () => () => {
      observerRef.current?.disconnect()
      clearTimeout(blockTimeoutRef.current)
      nodeRef.current = null
    },
    []
  )

  /** Forget the last measurement, so a reopened modal sizes itself from scratch. */
  const clearBounds = useCallback(() => setDimensions(unmeasured), [])

  /** Treat the next measurement as a first paint rather than a page swap. */
  const clearTransition = useCallback(() => setInTransition(undefined), [])

  return { dimensions, contentRef, inTransition, clearBounds, clearTransition }
}
