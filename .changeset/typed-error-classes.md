---
'@openfort/react': major
---

Added a typed error taxonomy and richer error messages.

`OpenfortError` is rebuilt on a composed message: the short message, any meta
messages, a docs link, the underlying failure's details and a
`Version: @openfort/react@x.y.z` footer. A pasted stack trace now carries enough
context to diagnose the problem without a reproduction. Every instance exposes
`shortMessage`, `details`, `docsPath`, `metaMessages` and a `walk(fn?)` helper
that traverses the `cause` chain.

**Bug fix:** when wrapping an existing `OpenfortError`, the previous constructor
called `super()` with the *inner* message and returned early, discarding the
outer message and every piece of context the outer layer added. Both are now
preserved — the outer short message heads `message`, and the inner error stays
reachable through `cause` and `details`.

28 concrete error classes replace the untyped `new OpenfortError(message, type)`
calls. Each class is exported from the package root for `instanceof` and
`error.name` checks, while the implementation-only companion types remain internal:

- Configuration — `OpenfortConfigError`, `WalletConfigNotFoundError`,
  `ClientNotInitializedError`, `ChainNotConfiguredError`,
  `RpcUrlNotConfiguredError`, `SolanaClusterNotSupportedError`
- Validation — `ValidationError`, `MissingParameterError`, `InvalidEmailError`
- Authentication — `AuthenticationError`, `NotAuthenticatedError`
- Wallet — `WalletError`, `WalletCreationError`, `WalletImportError`,
  `SetActiveWalletError`, `WalletNotFoundError`, `WalletNotConnectedError`,
  `ProviderNotReadyError`, `RecoveryError`, `OtpRequiredError`
- Connection — `ConnectorNotFoundError`, `ConnectorTypeMismatchError`,
  `ProviderNotFoundError`, `SiweMessageError`
- Funding — `FundingNotConfiguredError`, `FundingError`
- Operation — `UnsupportedOperationError`, `ApiRequestError`

Roughly 50 places that threw a bare `Error` now throw one of these, so failures
from funding, recovery OTP, RPC configuration and the onramp APIs are
classifiable instead of only readable.

`OpenfortReactErrorType` still populates the
`type` field on every instance, so existing `switch (error.type)` code keeps
working. It is deprecated in favour of narrowing on `error.name` or
`instanceof`. The deprecated `OpenfortErrorType` export was retained as an
alias of `OpenfortReactErrorType` so existing imports kept working. A few sites
now report a more accurate bucket than before: a
missing password and a missing 7702 contract address report `VALIDATION_ERROR`
rather than `CONFIGURATION_ERROR`, a missing wallet address reports
`WALLET_ERROR` rather than `UNEXPECTED_ERROR`, and an unsupported Solana
transaction format reports `UNEXPECTED_ERROR` rather than `CONFIGURATION_ERROR`.

**Breaking for direct constructor calls:** `new OpenfortError(message, type, data)`
becomes `new OpenfortError(shortMessage, { cause, details, docsPath, metaMessages })`,
and the `data` bag is gone. Constructing `OpenfortError` yourself is unusual —
the SDK produces them and apps read them — but direct constructor callers must
update for this major release.

Transaction failures shown on the send screens are also classified by error class
rather than by matching lowercased substrings against the raw message, which
misfired whenever an unrelated error happened to contain "timeout", "connection"
or "chain".
