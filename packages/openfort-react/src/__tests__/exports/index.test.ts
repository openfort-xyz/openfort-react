import { expect, test } from 'vitest'

import * as index from '../../index.js'

// Pins the runtime surface of the `@openfort/react` entry point. Adding or
// removing an export is a change consumers can see, so it has to be an
// intentional snapshot update rather than a silent side effect.
test('exports', () => {
  expect(Object.keys(index).sort()).toMatchInlineSnapshot(`
    [
      "AccountTypeEnum",
      "AuthProvider",
      "Avatar",
      "ChainIcon",
      "ChainTypeEnum",
      "FundingMethod",
      "LinkWalletOnSignUpOption",
      "OAuthProvider",
      "OPENFORT_VERSION",
      "OpenfortButton",
      "OpenfortError",
      "OpenfortErrorType",
      "OpenfortEvents",
      "OpenfortProvider",
      "OpenfortReactErrorType",
      "RecoveryMethod",
      "StoreContext",
      "ThirdPartyOAuthProvider",
      "createSIWEMessage",
      "embeddedWalletId",
      "formatAddress",
      "getDefaultSolanaRpcUrl",
      "getEmbeddedAccountsQueryOptions",
      "getUserQueryOptions",
      "invalidateBalance",
      "openfortEvents",
      "openfortKeys",
      "selectActiveAddress",
      "selectChainType",
      "selectEmbeddedState",
      "selectIsAuthenticated",
      "selectIsLoading",
      "selectUser",
      "selectWalletStatus",
      "use7702Authorization",
      "useAuthCallback",
      "useEmailAuth",
      "useEmailOtpAuth",
      "useFunding",
      "useGrantPermissions",
      "useGuestAuth",
      "useOAuth",
      "useOpenfort",
      "useOpenfortCore",
      "usePhoneOtpAuth",
      "useRevokePermissions",
      "useSignMessage",
      "useSignOut",
      "useUI",
      "useUser",
    ]
  `)
})
