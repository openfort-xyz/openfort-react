# design-sync notes — @openfort/react

Repo-specific gotchas for syncing `@openfort/react` to claude.ai/design (project: Openfort React UI).

## ⚠️ Untracked files get cleaned — keep `.design-sync/` git-tracked
An active process in this environment removes untracked, non-gitignored files (it wiped a scratch `ds-bundle-test/` and the whole `.design-sync/` durable set mid-run once). **Always `git add` the durable `.design-sync/` files** (config, NOTES, conventions, previews, stubs, preview-tsconfig, pages-entry) so they survive. Gitignored dirs (`.design-sync/.cache/`, `ds-bundle/`) and the staged scripts are fine.

## Build / entry
- Package manager: **pnpm** (`only-allow pnpm`); install with `pnpm i --frozen-lockfile`. Use `COREPACK_ENABLE_STRICT=0` to use the system pnpm.
- Converter dep install (`npm i esbuild ts-morph @types/react playwright@1.58.0` in `.ds-sync/`) **must pass `--no-workspaces`**: the repo's root `package.json` `workspaces` globs include the create-openfort templates, which duplicate the example workspace names. npm walks up, reads that config, and dies with "must not have multiple workspaces with the same name". `--no-workspaces` makes npm treat `.ds-sync/` as standalone. (pnpm is unaffected.)
- Build: `pnpm --filter @openfort/react build` (rollup, ~1.5 min, `preserveModules`). Output goes to `packages/openfort-react/build/` (NOT `dist/`).
- Converter entry: `packages/openfort-react/build/index.js`. `--node-modules`: `packages/openfort-react/node_modules` (pnpm keeps `react`/`react-dom`/`@types/react` symlinked there; nothing hoisted to repo root).

## Components & screens
- Public visual surface: **OpenfortButton, Avatar, ChainIcon** + the **OpenfortProvider** wrapper. Everything else exported from `index.ts` is hooks/types/enums — prune PascalCase non-components via `componentSrcMap: {Name: null}` (e.g. `OpenfortError`).
- The rich modal UI (auth/funding/wallet "Pages") is **internal** (not exported). It is surfaced for the DS via `.design-sync/pages-entry.mjs` (re-exports the built Page defaults onto `window.OpenfortReact`) + `cfg.extraEntries` + `cfg.componentSrcMap` pins. These render their real UI even disconnected because they're forms/selectors.
- Screens included (render well disconnected): ProvidersScreen, SocialProvidersScreen, EmailLoginScreen, EmailOtpScreen, PhoneOtpScreen, ForgotPasswordScreen, OnboardingScreen, SendScreen, ReceiveScreen, SelectTokenScreen, DepositScreen, BuyScreen, BuySelectProviderScreen, DepositCexScreen, DepositCryptoScreen, DepositWalletScreen, ProfileScreen, AboutScreen, ExportKeyScreen.
- Screens EXCLUDED (need a live wallet/wagmi — render as floor card or error bar): **Connected** (ConnectKitThemeProvider error), **CreateWallet**/**Connectors** ("No connection found in Openfort config" red bar — need wagmi connectors), **Recover** (floor), **LinkedProviders**/**SelectWalletToRecover** (sparse/empty). DepositCrypto/DepositWallet render light ("funding isn't available right now") but show the real header — kept.

## Provider
- All components require `OpenfortProvider` context. `cfg.provider` = `OpenfortProvider` with a fake `publishableKey: "pk_test_preview"`.
- wagmi + react-query are NOT required for static (disconnected) render. The full `QueryClient → Wagmi → OpenfortWagmiBridge → OpenfortProvider` chain (see examples/quickstarts/openfort-ui/src/components/providers.tsx) is only for connected/live states. The bundle is built from the MAIN entry only — `window.OpenfortReact` does NOT expose the `/wagmi` bridge.

## Styling idiom
- CSS-in-JS via **styled-components** + framer-motion. Styles inject at runtime → expect `[CSS_RUNTIME]` (self-styling bundle, no static stylesheet). Non-blocking.
- Theme tokens are CSS custom properties `--ck-*` (src/styles/customTheme.ts). Named theme presets via the `theme` prop: `auto | web95 | retro | soft | midnight | minimal | rounded | nouns`; `mode`: `light | dark | auto`.

## Bundle slimming (REQUIRED — keeps bundle under the 5 MB upload cap)
- The full bundle is ~5.4 MB unminified (`[FILE_OVER_5MB]`). The single biggest non-render dependency is **Sentry telemetry** (~1.15 MB), pulled in only by `@openfort/openfort-js`.
- Stubbed via the converter's supported `cfg.tsconfig` path-alias plugin (NO fork of lib/bundle.mjs):
  - `cfg.tsconfig` = `../../.design-sync/preview-tsconfig.json` (package-relative; resolves to the repo-root file, inside the git workspaceRoot bound).
  - Maps `@sentry/browser` → `.design-sync/stubs/sentry-browser.js` (the only top-level Sentry specifier; transitive @sentry/* then never resolve).
  - **The tsconfig must NOT contain a `"//"` doc key** — the converter's tsconfig-paths plugin strips `//` comments naively; a `"//"` key corrupts the JSON and silently disables the plugin (bundle balloons back to 5.4 MB).
  - The stub exports real named `BrowserClient` / `defaultStackParser` / `makeFetchTransport` (the SDK does `await import('@sentry/browser')` then `new a.BrowserClient(...)`). A bare Proxy fails — esbuild's CJS→ESM interop snapshots own keys. `BrowserClient.getDsn()` returns parts matching the SDK's hardcoded DSN so `init()` completes silently.
- Result: bundle ~4.6 MB even with the screens added (they were already inside the bundle).

## Render check (playwright)
- Cached chromium builds: 1148, 1208. **`playwright@1.58.0` pins chromium 1208** → install that in `.ds-sync` to reuse the cache with no ~150 MB download. (Repo pins playwright 1.61.0 → chromium 1228, NOT cached.)

## Known render warns (triaged)
- `[CSS_RUNTIME]` styles.css has no @imports — expected: styled-components injects at runtime.
- OpenfortProvider shows the **floor card** by design (it's the wrapper; rendering it inside cfg.provider trips "Multiple, nested usages"). Do NOT "fix" it.

## Composition sources (for authored previews)
- ChainIcon ids with logos: Ethereum 1, Optimism 10, Polygon 137, Arbitrum One 42161, Base 8453, Zora 7777777. Avatar gradient (`--ck-ens-0X-*`, 8 color pairs) is seeded from the address; pass `unsupported={false}` to ChainIcon to suppress the warning overlay.
- Screen previews are zero-prop: `export const Default = () => <XScreen />`.

## Re-sync risks (what can silently go stale)
- **Sentry DSN hardcode (`stubs/sentry-browser.js`)**: `getDsn()` must match the DSN hardcoded in `@openfort/openfort-js`'s `core/errors/sentry.js`. If the SDK bumps its DSN, `init()` throws async noise that re-flags components `bad`. Fix: copy the new DSN parts in. Verify after any openfort-js bump.
- **Single Sentry specifier assumption**: slimming relies on `@sentry/browser` being the ONLY top-level `@sentry/*` import. If `[FILE_OVER_5MB]` returns, re-trace importers (esbuild metafile) and add new specifiers to `preview-tsconfig.json` + a stub.
- **Screen rendering depends on disconnected states staying renderable**: if upstream makes a screen hard-require a live wallet, it may drop to a floor card / error bar. Re-check the contact sheet and move it to the excluded list if so.
- **playwright/chromium cache**: re-find a playwright version matching a cached chromium build on a fresh machine, or accept a download. `.ds-sync/node_modules` is gitignored — reinstall converter deps per clone.
