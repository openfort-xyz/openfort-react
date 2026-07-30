import { expect, test } from 'vitest'

import * as solana from '../../solana/index.js'

// Pins the runtime surface of the `@openfort/react/solana` entry point.
test('exports', () => {
  expect(Object.keys(solana).sort()).toMatchInlineSnapshot(`
    [
      "useSolanaEmbeddedWallet",
    ]
  `)
})
