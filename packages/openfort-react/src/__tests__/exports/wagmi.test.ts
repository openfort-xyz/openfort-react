import { expect, test } from 'vitest'

import * as wagmi from '../../wagmi/index.js'

// Pins the runtime surface of the `@openfort/react/wagmi` entry point.
test('exports', () => {
  expect(Object.keys(wagmi).sort()).toMatchInlineSnapshot(`
    [
      "EmbeddedWalletWagmiSync",
      "OpenfortWagmiBridge",
      "embeddedWalletConnector",
      "getDefaultConfig",
      "getDefaultConnectors",
      "setEmbeddedWalletProvider",
      "useChainIsSupported",
      "useChains",
      "useConnectWithSiwe",
      "useWalletAuth",
    ]
  `)
})
