# Security Policy

## Reporting a Vulnerability

Report privately through
[GitHub private vulnerability reporting](https://github.com/openfort-xyz/openfort-react/security/advisories/new),
or by email to security@openfort.xyz. Please do not open a public issue, pull
request, or discussion for an unfixed vulnerability.

Include:

- a description of the issue and its impact,
- a suggested severity (Critical / High / Medium / Low),
- the affected version of `@openfort/react`,
- a minimal reproducible example.

**Response targets:** acknowledgement within 2 business days, initial triage
within 5 business days, and a status update at least every 7 days until the
issue is resolved.

## Scope

In scope — the packages published from this repository, in particular
`@openfort/react`:

- embedded-wallet flows: wallet creation, recovery, export, and the
  password/passkey material those flows handle,
- authentication and token storage: the auth providers, OAuth and SIWE
  callbacks, and everything persisted about a session,
- session keys and the policies that bound what a registered session may sign,
- signing paths (`personal_sign`, `eth_signTypedData_v4`, transaction and
  Solana message signing) reached through the hooks and connectors,
- the modal UI's handling of wallet-supplied strings — connector names, chain
  metadata, error messages and any other value that originates outside the
  integrating app and is rendered or copied to the clipboard.

Out of scope:

- the Openfort dashboard and backend API — report those to
  security@openfort.xyz, which covers all Openfort products,
- issues that require an already-compromised device or a malicious host
  application (an attacker executing JavaScript on the integrating origin can
  already reach anything this SDK can),
- dependency advisories with no exploitable path through this SDK,
- the sample applications under `examples/`, which use sandbox credentials and
  are illustrative only.

## Safe Harbor

We will not pursue legal action for security research conducted in good faith
under this policy. Good faith means: no access to other users' data or accounts
beyond what is needed to demonstrate the issue, no service degradation, no data
exfiltration, and private disclosure to us before any public discussion.

## Supported Versions

Only the latest major version of `@openfort/react` receives security patches.
Once a new major is released, the previous major stops receiving fixes, so
upgrading to the current major is a prerequisite for security support.

Security patches are released on the latest minor of the supported major and
published as a GitHub Security Advisory on this repository as well as to npm.
