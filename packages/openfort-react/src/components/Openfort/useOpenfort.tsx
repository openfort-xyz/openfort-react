'use client'

import { useContext, useMemo } from 'react'
import {
  type ConfigContextValue,
  type ContextValue,
  FormContext,
  type FormContextValue,
  OpenfortContext,
  RoutingContext,
  type RoutingContextValue,
  type ThemeContextValue,
  ThemeStateContext,
} from './context.js'

function useRequiredContext<T>(context: React.Context<T | null>): T {
  const value = useContext(context)
  if (!value) throw Error('Openfort Hook must be inside a Provider.')
  return value
}

/** Theme, color mode and language of the modal. */
export const useOpenfortTheme = (): ThemeContextValue => useRequiredContext(ThemeStateContext)

/** Modal visibility, the current route and its history. */
export const useOpenfortRouting = (): RoutingContextValue => useRequiredContext(RoutingContext)

/** Draft input shared across the auth, send and buy flows. */
export const useOpenfortForms = (): FormContextValue => useRequiredContext(FormContext)

/** Values fixed by the props passed to OpenfortProvider. */
export const useOpenfortConfig = (): ConfigContextValue => useRequiredContext(OpenfortContext)

/**
 * Everything the modal's provider holds, in one object. Prefer the narrower
 * hooks above where a component only reads one slice: this one re-renders on
 * any change, including every keystroke in a form field.
 */
export const useOpenfort = (): ContextValue => {
  const theme = useOpenfortTheme()
  const routing = useOpenfortRouting()
  const forms = useOpenfortForms()
  const config = useOpenfortConfig()

  return useMemo(() => ({ ...theme, ...routing, ...forms, ...config }), [theme, routing, forms, config])
}

/** Alias used by sub-path bundles to avoid naming collision with the public useOpenfort (useOpenfortCore). */
export { useOpenfort as useOpenfortUIContext }
