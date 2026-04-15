# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this SDK, please report it privately.

**Please do not open a public GitHub issue for security reports.**

- Email: **security@openfort.xyz**
- Encrypted / signed reports are welcome.

We will acknowledge receipt within **3 business days** and aim to provide an initial triage within **7 business days**. Once a fix is available, we coordinate a disclosure timeline with the reporter before publishing.

When reporting, please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, a proof-of-concept, or a failing test.
- The affected SDK version (`pnpm list @openfort/openfort-react`), browser/runtime, and any relevant config.
- Whether the issue is already public and, if so, where.

## Supported Versions

Security fixes are published for the **latest minor release** of `@openfort/openfort-react`. Older releases are supported on a best-effort basis.

| Version       | Supported |
| ------------- | --------- |
| Latest minor  | ✅        |
| Older minors  | ⚠️ best-effort |
| Pre-release   | ❌        |

## Scope

The following are in scope:

- Code under `packages/openfort-react/`.
- The SDK's public API surface, storage handling, URL handling, signing flows, and OAuth callback handling.
- Dependency vulnerabilities that are reachable via default SDK usage.

Out of scope:

- Issues requiring a user to install a malicious browser extension.
- Issues in third-party wallets, RPC providers, or services the SDK integrates with — please report those to the vendor.
- Denial-of-service against the consuming application that does not involve SDK-level exploitation.

## Security Best Practices for Integrators

- Always configure an explicit `chainId`; do not rely on defaults.
- Use the built-in `safeExternalHref` / `safeImageSrc` helpers (`utils/urlSecurity`) when rendering user-influenced URLs.
- Host the `createEncryptedSessionEndpoint` on HTTPS; the SDK rejects non-`http(s):` endpoints.
- Keep `@openfort/openfort-react` pinned to the latest patch release to receive security fixes.
