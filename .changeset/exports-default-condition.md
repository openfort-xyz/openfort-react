---
'@openfort/react': patch
---

Completed the package exports map. Every subpath (`.`, `./solana`, `./ethereum`, `./wagmi`) now carries a `default` condition alongside `types` and `import`, so resolvers that apply custom conditions (`workerd`, `react-native`, `require`) land on the ESM build instead of failing to match. `./package.json` is also exported, which tooling reads to discover package metadata.
