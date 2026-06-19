# Deposit send page

Standalone page that the `@openfort/react` Deposit hub links to from mobile
("Transfer from wallet"). A wallet's open-dApp deeplink opens this page in the
wallet's in-app browser; the page reads the transfer details from the URL and
sends them via the injected provider (`window.ethereum`). No auth, no backend,
no Openfort SDK.

Deployed at **https://deposit.openfort.io** — the default `depositPageUrl` in
`@openfort/react`. Integrators can self-host instead and set
`uiConfig.funding.depositPageUrl`.

## URL params

| param      | required | meaning                                              |
| ---------- | -------- | ---------------------------------------------------- |
| `to`       | yes      | deposit address (Relay receiver)                     |
| `chainId`  | yes      | numeric source chain id                              |
| `token`    | no       | ERC-20 contract; omit for the native token           |
| `decimals` | no       | token decimals (default 18)                          |
| `symbol`   | no       | display symbol                                       |
| `chain`    | no       | display chain name                                   |
| `amount`   | no       | preset amount in base units (uint256); user-editable |

The link format and these params are produced by
`packages/openfort-react/src/components/Pages/DepositWallet/walletDeeplinks.ts`
— keep the two in sync.

## Deploy

Static single file, no build step. Hosted on **Cloudflare Pages**, auto-deployed
by `.github/workflows/deploy-deposit-page.yml` on push to `main` that touches
`hosted/deposit-page/**`.

### One-time setup

1. **Create the Pages project** (named `openfort-deposit-page`, production branch `main`):
   ```
   wrangler pages project create openfort-deposit-page --production-branch=main
   ```
   (or via the Cloudflare dashboard → Workers & Pages → Create → Pages).
2. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN` — token with the **Cloudflare Pages: Edit** permission.
   - `CLOUDFLARE_ACCOUNT_ID` — the account id.
3. **Custom domain**: in the Pages project → Custom domains → add `deposit.openfort.io`
   (Cloudflare provisions the TLS cert). The workflow's `--branch=main` deploy is
   the production deployment the domain serves.

### Manual deploy

`workflow_dispatch` (Actions tab → Deploy deposit page → Run), or locally:
```
wrangler pages deploy hosted/deposit-page --project-name=openfort-deposit-page --branch=main
```

If the project name changes, update it in both the workflow and these commands.

## Security

This page triggers token transfers from the user's wallet, so the origin must be
trusted:

- Serve over HTTPS from a domain you control.
- No third-party scripts, trackers, or analytics — keep it self-contained.
- It shows `to` / `amount` / `chain` before the user confirms; the user reviews
  the destination in their wallet too.
- Treat changes like any code that moves funds: review and pin.
