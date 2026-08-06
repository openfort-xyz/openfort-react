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
