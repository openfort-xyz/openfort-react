---
'@openfort/react': patch
---

Fixed builds for apps that do not install `wagmi`. The root entry reaches the wagmi integration through lazy chunks, so the module stays in a consumer's build graph even when wagmi is absent, and bundlers that substitute a stub for a missing optional peer failed on the named imports — a Solana-only Vite 8 app could not build at all. Those modules now bind wagmi through a namespace import, so the stub resolves cleanly; the chunks still load only when `OpenfortWagmiBridge` is present, which requires wagmi.
