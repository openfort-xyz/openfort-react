'use client'

import { createContext, useContext } from 'react'
import type { AuthSession, AuthTransitionStarter } from '../shared/utils/authTransitionQueue.js'

export type AuthTransitionContextValue = {
  captureAuthSession: () => AuthSession
  startAuthTransition: AuthTransitionStarter
  startAuthenticatedMutation: AuthTransitionStarter
}

export const AuthTransitionContext = createContext<AuthTransitionContextValue | null>(null)

export function useAuthTransitions(): AuthTransitionContextValue {
  const value = useContext(AuthTransitionContext)
  if (!value) throw new Error('useAuthTransitions must be inside CoreOpenfortProvider.')
  return value
}
