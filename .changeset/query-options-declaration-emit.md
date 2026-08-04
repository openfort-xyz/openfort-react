---
'@openfort/react': patch
---

Fixed the shipped declarations for `getUserQueryOptions` and `getEmbeddedAccountsQueryOptions`. Their return types were inferred from TanStack's `queryOptions()`, and the emitted `build/query/queryOptions.d.ts` printed the resulting `User$2`, `dataTagSymbol` and `dataTagErrorSymbol` without importing any of them, so consumers compiling with `skipLibCheck: false` hit `TS2304: Cannot find name` on both factories. Both now declare named return types — `UserQueryOptions` and `EmbeddedAccountsQueryOptions`, built from `UnusedSkipTokenOptions` and `DataTag` and exported alongside their `UserQueryKey` and `EmbeddedAccountsQueryKey` key types — so the declaration only names types it imports. The tagged keys are preserved, so `queryClient.getQueryData(getUserQueryOptions(client).queryKey)` infers `User`.

Also fixed the linked-account list going `undefined` in the store when the API returns a user with no linked accounts, which broke the components that iterate it.
