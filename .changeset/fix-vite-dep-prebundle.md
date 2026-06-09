---
'@openfort/react': patch
---

Fix blank screen in Vite apps. The `OpenfortProvider` lazy imports carried a `@vite-ignore` hint, which made Vite's dependency pre-bundler keep the relative dynamic imports external — so they resolved against `node_modules/.vite/deps` instead of the package and the provider failed to load in dev ("Failed to resolve import ../../solana/SolanaContext.js"). Removing the hint lets Vite (and Rollup/webpack) resolve and code-split the chunks correctly.
