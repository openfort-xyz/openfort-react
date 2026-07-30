import { EmbeddedState } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { isAuthenticatedState } from '../../openfort/selectors.js'

describe('isAuthenticatedState', () => {
  it('is false before a session exists', () => {
    expect(isAuthenticatedState(EmbeddedState.NONE)).toBe(false)
    expect(isAuthenticatedState(EmbeddedState.UNAUTHENTICATED)).toBe(false)
  })

  it('is true for every state that follows sign-in, including account creation', () => {
    expect(isAuthenticatedState(EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED)).toBe(true)
    expect(isAuthenticatedState(EmbeddedState.CREATING_ACCOUNT)).toBe(true)
    expect(isAuthenticatedState(EmbeddedState.READY)).toBe(true)
  })
})
