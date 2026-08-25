import { expectTypeOf, test } from 'vitest'
import type { OpenfortStore } from './store.js'

test('auth transition controls are not exposed through the public core store', () => {
  type TransitionControls = Extract<keyof OpenfortStore, 'invalidateSession' | 'startAuthTransition'>
  expectTypeOf<TransitionControls>().toEqualTypeOf<never>()
})
