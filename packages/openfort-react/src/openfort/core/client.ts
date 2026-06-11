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
 * Sets the shared {@link OpenfortClient} instance.
 * Kept for backwards compatibility; the client is provided via React context.
 *
 * @param client - Pre-configured Openfort client to store as the default.
 *
 * @example
 * ```ts
 * const client = createOpenfortClient({ baseConfiguration: { publishableKey: 'pk' } });
 * setDefaultClient(client);
 * ```
 */
export function setDefaultClient(_client: OpenfortClient): void {
  // No-op: client is provided via CoreOpenfortProvider context
}
