## Building with @openfort/react

`@openfort/react` is a wallet-integration UI library. The composable components are
**`OpenfortButton`** (the connect button that opens the auth/wallet modal),
**`Avatar`** (a wallet identicon), and **`ChainIcon`** (a network logo), all powered
by **`OpenfortProvider`**, the required root wrapper. The design system also includes
the modal **screens** that live behind `OpenfortButton` (e.g. `ProvidersScreen` =
the connect screen, `SendScreen`, `ReceiveScreen`, `DepositScreen`, `BuyScreen`,
`ProfileScreen`) for reference — see "Screens" below.

### Wrapping and setup (required)

Every component reads theme, locale, and wallet state from `OpenfortProvider`'s context.
Rendering any of them outside the provider throws or renders blank. Wrap the subtree once:

```jsx
const { OpenfortProvider, OpenfortButton } = window.OpenfortReact

function App() {
  return (
    <OpenfortProvider publishableKey="pk_test_xxx">
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
        <OpenfortButton label="Sign in" />
      </main>
    </OpenfortProvider>
  )
}
```

- `publishableKey` is required (any non-empty string renders; a real Openfort key is needed
  for live auth). Mount `OpenfortProvider` **once** — nesting it throws "Multiple, nested
  usages of OpenfortProvider".
- In a production app, external-wallet (EVM) sign-in additionally needs the wagmi chain
  (`QueryClientProvider → WagmiProvider → OpenfortWagmiBridge → OpenfortProvider`, from
  `@openfort/react/wagmi`). That wiring lives in the host app, not this bundle — see the
  full snippet and links in `README.md`. It is not needed to render or compose these
  components in a design.

### Styling idiom — props, not classes

There is **no utility-class system**. Components style themselves at runtime (styled-components),
so you restyle them through props, and lay out *around* them with your own CSS / inline styles:

- **`theme`** — one of `"auto" | "web95" | "retro" | "soft" | "midnight" | "minimal" | "rounded" | "nouns"`.
  Switches the whole look (border radius, color, weight). Set on `OpenfortButton` directly, or
  app-wide via `OpenfortProvider`'s `uiConfig={{ theme }}`.
- **`mode`** — `"light" | "dark" | "auto"`.
- **`customTheme`** — fine-grained overrides as CSS custom properties named `--ck-*`
  (e.g. `--ck-connectbutton-background`, `--ck-border-radius`, `--ck-font-family`). See the
  `CustomTheme` type in `OpenfortButton.d.ts`.

`Avatar` (`address`, `size`, `radius`) draws a deterministic gradient identicon seeded from the
address. `ChainIcon` (`id`, `size`, `unsupported`) renders a network logo by EVM chain id.

### Screens (the modal flows)

`*Screen` components are the internal pages of the connect modal, surfaced here for reference.
They are **not part of the public `@openfort/react` API** — in a real app they appear inside the
`OpenfortButton` modal, routed automatically; you do not place them yourself. Use them to see and
match the look of the connect, send, receive, and funding flows. Each is zero-prop and renders
inside `OpenfortProvider`.

### Where the truth lives

Per component, read `components/<group>/<Name>/<Name>.prompt.md` (usage + variants) and
`<Name>.d.ts` (the prop contract) before composing. The bundle is self-styling — there is no
component stylesheet to import beyond `styles.css`.
