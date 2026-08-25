import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Alert from '../../components/Common/Alert/index.js'

/**
 * The danger style was gated on `${($error) => …}`, which names the whole props
 * object `$error` rather than destructuring it — always truthy, so every alert
 * painted itself red. Styled-components emits one class per distinct rule set,
 * so the two variants sharing a class means the gate is dead again.
 */
describe('Alert', () => {
  it('styles the error variant differently from the default one', () => {
    const { container: plain } = render(<Alert>Nothing is wrong</Alert>)
    const { container: danger } = render(<Alert error>Something is wrong</Alert>)

    expect(plain.firstElementChild?.className).not.toEqual(danger.firstElementChild?.className)
  })
})
