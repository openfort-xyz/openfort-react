import type { ComponentProps } from 'react'
import { assertType, expectTypeOf, test } from 'vitest'

import type { CustomTheme, Mode, Theme } from '../../types.js'
import type { OpenfortButton } from './index.js'

type Props = ComponentProps<typeof OpenfortButton>

test('every prop is optional', () => {
  assertType<Props>({})
})

test('prop types', () => {
  expectTypeOf<Props['label']>().toEqualTypeOf<string | undefined>()
  expectTypeOf<Props['showBalance']>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<Props['showAvatar']>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<Props['theme']>().toEqualTypeOf<Theme | undefined>()
  expectTypeOf<Props['mode']>().toEqualTypeOf<Mode | undefined>()
  expectTypeOf<Props['customTheme']>().toEqualTypeOf<CustomTheme | undefined>()
})

test('onClick receives an opener callback', () => {
  expectTypeOf<Props['onClick']>().toEqualTypeOf<((open: () => void) => void) | undefined>()
})

test('rejects unknown props', () => {
  // @ts-expect-error - `variant` is not part of the button API.
  assertType<Props>({ variant: 'primary' })
})
