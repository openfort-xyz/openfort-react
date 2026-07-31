import { Openfort as OpenfortClient, type OpenfortSDKConfiguration } from '@openfort/openfort-js'

/**
 * Creates a new {@link OpenfortClient} instance.
 *
 * @param config - Configuration options passed directly to the Openfort SDK constructor.
 * @returns A configured Openfort client instance.
 *
 * @example
 * ```ts
 * const client = createOpenfortClient({
 *   baseConfiguration: { publishableKey: 'pk_test_123' },
 * });
 *
 * const token = await client.getAccessToken();
 * ```
 */
export function createOpenfortClient(config: OpenfortSDKConfiguration): OpenfortClient {
  return new OpenfortClient(config)
}

/**
 * Compatibility no-op retained for callers that previously configured a shared client.
 * `OpenfortProvider` creates and provides its own client through React context.
 *
 * @param client - Ignored. Pass configuration to `OpenfortProvider` instead.
 * @deprecated This function has no effect and will be removed in a future major release.
 *
 * @example
 * ```ts
 * const client = createOpenfortClient({ baseConfiguration: { publishableKey: 'pk_test_123' } });
 * setDefaultClient(client);
 * ```
 */
export function setDefaultClient(_client: OpenfortClient): void {
  // No-op: client is provided via CoreOpenfortProvider context
}
