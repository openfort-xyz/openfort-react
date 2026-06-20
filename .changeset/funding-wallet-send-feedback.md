---
'@openfort/react': patch
---

Reveal the desktop "Transfer from wallet" send feedback. `DepositWalletDesktop` never triggered a modal resize, so the "Confirm in your wallet…" status and the insufficient-balance message ("Not enough X — you have Y") were clipped below the fold — a click on a wallet with too little balance read as "nothing happened". The modal now resizes when that feedback toggles.
