---
'@openfort/react': patch
---

Fix white screen when sending a native token (e.g. ETH) from the wallet balance. The gas-estimate query keyed on the bigint send amount, and `useAsyncData` serialized its key with `JSON.stringify`, which throws on a BigInt and crashed the confirm modal. Query keys are now serialized bigint-safely.
