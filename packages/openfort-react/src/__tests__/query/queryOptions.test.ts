import type { Openfort } from '@openfort/openfort-js'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type {
  EmbeddedAccountsQueryKey,
  EmbeddedAccountsQueryOptions,
  UserQueryKey,
  UserQueryOptions,
} from '../../index.js'
import { getEmbeddedAccountsQueryOptions, getUserQueryOptions } from '../../query/queryOptions.js'
import { createMockOpenfortClient } from '../mocks/openfortClient.js'

const client = createMockOpenfortClient() as unknown as Openfort

describe('Openfort query policies', () => {
  it('keeps the current user fresh across nearby mounts', () => {
    expect(getUserQueryOptions(client).staleTime).toBe(30_000)
  })

  it('does not duplicate the provider account fetch on mount or window focus', () => {
    const options = getEmbeddedAccountsQueryOptions(client)

    expect(options.refetchOnMount).toBe(false)
    expect(options.refetchOnWindowFocus).toBe(false)
  })

  it('keeps user and embedded-account entries isolated by client identity', async () => {
    const firstClient = createMockOpenfortClient() as unknown as Openfort
    const secondClient = createMockOpenfortClient() as unknown as Openfort
    vi.mocked(firstClient.user.get).mockResolvedValue({ id: 'first-user', linkedAccounts: [] })
    vi.mocked(secondClient.user.get).mockResolvedValue({ id: 'second-user', linkedAccounts: [] })
    vi.mocked(firstClient.embeddedWallet.list).mockResolvedValue([{ id: 'first-account' }] as never)
    vi.mocked(secondClient.embeddedWallet.list).mockResolvedValue([{ id: 'second-account' }] as never)
    const firstUserOptions = getUserQueryOptions(firstClient)
    const secondUserOptions = getUserQueryOptions(secondClient)
    const firstAccountsOptions = getEmbeddedAccountsQueryOptions(firstClient)
    const secondAccountsOptions = getEmbeddedAccountsQueryOptions(secondClient)
    const queryClient = new QueryClient()

    await Promise.all([
      queryClient.fetchQuery(firstUserOptions),
      queryClient.fetchQuery(secondUserOptions),
      queryClient.fetchQuery(firstAccountsOptions),
      queryClient.fetchQuery(secondAccountsOptions),
    ])

    expect(firstUserOptions.queryKey).not.toEqual(secondUserOptions.queryKey)
    expect(firstAccountsOptions.queryKey).not.toEqual(secondAccountsOptions.queryKey)
    expect(firstClient.user.get).toHaveBeenCalledOnce()
    expect(secondClient.user.get).toHaveBeenCalledOnce()
    expect(firstClient.embeddedWallet.list).toHaveBeenCalledOnce()
    expect(secondClient.embeddedWallet.list).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(firstUserOptions.queryKey)).toMatchObject({ id: 'first-user' })
    expect(queryClient.getQueryData(secondUserOptions.queryKey)).toMatchObject({ id: 'second-user' })
    expect(queryClient.getQueryData(firstAccountsOptions.queryKey)).toEqual([{ id: 'first-account' }])
    expect(queryClient.getQueryData(secondAccountsOptions.queryKey)).toEqual([{ id: 'second-account' }])
  })

  it('exposes named query option and key types from the package root', () => {
    const userOptions = getUserQueryOptions(client)
    const accountOptions = getEmbeddedAccountsQueryOptions(client)

    expectTypeOf(userOptions).toMatchTypeOf<UserQueryOptions>()
    expectTypeOf(userOptions.queryKey).toMatchTypeOf<UserQueryKey>()
    expectTypeOf(accountOptions).toMatchTypeOf<EmbeddedAccountsQueryOptions>()
    expectTypeOf(accountOptions.queryKey).toMatchTypeOf<EmbeddedAccountsQueryKey>()
  })
})
