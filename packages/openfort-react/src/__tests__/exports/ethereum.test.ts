import { expect, test } from 'vitest'

import * as ethereum from '../../ethereum/index.js'

// Pins the runtime surface of the `@openfort/react/ethereum` entry point.
test('exports', () => {
  expect(Object.keys(ethereum).sort()).toMatchInlineSnapshot(`
    [
      "useEthereumEmbeddedWallet",
      "useEthereumWalletAssets",
    ]
  `)
})
