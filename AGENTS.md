# Openfort React SDK — contributor and agent guide

Applies to humans and AI agents alike. `CLAUDE.md` points here.

## Layout

- `packages/openfort-react/` — `@openfort/react`, the SDK.
  Four public entry points, each with its own `index.ts`:
  - `src/index.ts` → `@openfort/react`. **Anything exported here is API** and
    cannot change without a major version.
  - `src/ethereum/index.ts` → `@openfort/react/ethereum`
  - `src/solana/index.ts` → `@openfort/react/solana`
  - `src/wagmi/index.ts` → `@openfort/react/wagmi`

  `src/internal/index.ts` → `@openfort/react/internal` exists for the
  playground and the example apps. It is not a consumer API: nothing outside
  this repository should import it, and it may change in a patch.

  Inside the package:
  - `src/actions/` — plain async functions holding the embedded-wallet logic.
    They take an explicit parameters object, know nothing about React, and
    throw typed errors. Hooks wrap them; tests call them directly.
  - `src/errors/` — the typed error classes. `src/errors/base.ts` defines the
    root; every other file is one family (auth, config, connection, funding,
    operation, validation, wallet).
  - `src/query/` — TanStack Query integration: the key factory
    (`queryKeys.ts`), the shared query options (`queryOptions.ts`) and the
    boundary component that supplies a client when the host app has none.
  - `src/shared/hooks/createEmbeddedWalletHook.ts` — the factory both chain
    families are built from. A change here affects Ethereum and Solana at
    once; prefer adding to the factory over duplicating a hook per chain.
  - `src/components/` — the modal UI. `src/openfort/` — the provider, store
    and core client wiring.
- `packages/create-openfort/` — the `create-openfort` CLI and its project
  templates. Templates are copied verbatim into user projects.
- `environments/` — consumer smoke tests against the **built** package.
  `tsc/` type-checks it under both `bundler` and `node16` resolution; `node/`
  imports every entry point in bare Node, which is what a server-rendered app
  does before React decides what to render.
- `examples/` — sample apps and the Playwright playground. Not published,
  sandbox credentials only.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm check` | Biome lint and format check. `pnpm check:fix` writes. |
| `pnpm check:types` | `tsc --noEmit` over the package, type tests included. |
| `pnpm check:repo` | sherif — workspace dependency hygiene. |
| `pnpm test:unit` | vitest, the whole unit suite. |
| `pnpm test:cov` | The same suite with coverage. |
| `pnpm test:types` | Type-level assertions (`*.test-d.ts`). |
| `pnpm test:build` | publint and attw over the built package. |
| `pnpm test:env` | Consumes the built package from `environments/`. |
| `pnpm size` | Bundle-size budgets. |
| `pnpm scan:secrets` | gitleaks over the staged change. |
| `pnpm build:docs` | TypeDoc reference into `docs/`. Must stay warning-free. |
| `pnpm verify` | Everything above, in dependency order. Run before a PR. |

`pnpm check:repo` ignores the example apps. Each quickstart is a standalone
template that a user copies and then owns, so they pin their dependencies
independently of each other and of the SDK; the rule still applies to the
published packages, the root and `environments/`.

## Rules

- Any change to a published package needs a changeset (`pnpm changeset`).
  PR titles are imperative ("Add X"); changeset text is past tense ("Added X").
- Relative imports carry the `.js` extension (`'../errors/auth.js'`), matching
  what the emitted ESM resolves at runtime.
- The `src/__tests__/exports/` snapshots pin the runtime surface of all five
  entry points. Adding or removing an export fails them by design — update the
  snapshot deliberately, and treat it as the moment to ask whether the export
  belongs in the public API at all.
- New exports from `src/index.ts` need JSDoc with a runnable `@example`.
  Prefer not to export at all over exporting something internal.
- Action hooks never throw. The mutation they return resolves either way and
  reports failure through the returned state and the `onError` callback, so a
  consumer who forgets a `try`/`catch` cannot crash the render tree. Throw from
  `src/actions/`; catch at the hook boundary.
- Errors thrown from `src/actions/` are the typed classes in `src/errors/`,
  never bare `Error`. Consumers branch on the class.
- Every `biome-ignore` carries a justification after the colon explaining why
  the rule does not apply here. An ignore without one is a bug to fix rather
  than suppress.
- Do not log or snapshot sensitive material: private keys, recovery passwords,
  encryption keys, passkey-derived keys, access or refresh tokens.
- Comments describe the code as it stands. They do not narrate history, refer
  to previous versions, or explain what something used to do — a reader with
  only the current file must be able to follow them.
- Prefer deleting dead code over commenting it out or suppressing the linter.

## Testing

- Colocated `*.test.ts` next to the code, plus `src/__tests__/` for suites that
  span modules. Run with vitest.
- Test behaviour, not implementation. Cover error paths, not just the happy
  path.
- After writing a test for a validation path, confirm it fails when that
  validation is removed.
- Fixtures use obviously fake values. Real credentials — even sandbox ones —
  do not belong in new code.

## Style

Biome, configured in `biome.json`. `pnpm check:fix` applies what it can.
