import { describe, expect, it } from 'vitest'
import { getPublishableKeyEnvironment } from '../../utils/validation'

const UUID = '00000000-0000-0000-0000-000000000000'

describe('getPublishableKeyEnvironment', () => {
  it('returns "test" for a pk_test_ key', () => {
    expect(getPublishableKeyEnvironment(`pk_test_${UUID}`)).toBe('test')
  })

  it('returns "live" for a pk_live_ key', () => {
    expect(getPublishableKeyEnvironment(`pk_live_${UUID}`)).toBe('live')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['garbage', 'not-a-key'],
    ['secret test key', `sk_test_${UUID}`],
    ['secret live key', `sk_live_${UUID}`],
    ['missing underscore', 'pk_test'],
    ['uppercase prefix', `PK_TEST_${UUID}`],
  ])('returns null for %s', (_label, value) => {
    expect(getPublishableKeyEnvironment(value)).toBeNull()
  })
})
