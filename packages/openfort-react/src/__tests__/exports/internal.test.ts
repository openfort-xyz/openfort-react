import { expect, test } from 'vitest'

import * as internal from '../../internal/index.js'

// Pins the runtime surface of the `@openfort/react/internal` entry point. The
// entry makes no stability promise to consumers, but the root barrel still
// re-exports every name here, so a change is visible from the public surface.
test('exports', () => {
  expect(Object.keys(internal).sort()).toMatchInlineSnapshot(`
    [
      "StoreContext",
      "selectActiveAddress",
      "selectChainType",
      "selectEmbeddedState",
      "selectIsAuthenticated",
      "selectIsLoading",
      "selectUser",
      "selectWalletStatus",
    ]
  `)
})
