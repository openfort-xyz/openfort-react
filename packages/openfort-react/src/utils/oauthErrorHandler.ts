/**
 * Utility to handle and provide better error messages for OAuth configuration errors
 */

import { logger } from './logger'

export function handleOAuthConfigError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : ''
  if (message.includes('OAuth Config with provider') && message.includes('not found')) {
    const providerMatch = message.match(/provider\s+(\w+)\s+not found/i)
    const provider = providerMatch ? providerMatch[1] : 'unknown'
    const providerLower = provider.toLowerCase()

    // Provider-specific configuration hints
    const configHints: Record<string, string> = {
      playfab: '- PlayFab title ID: Your PlayFab title ID',
      firebase: '- Firebase project ID: Your Firebase project ID (e.g., test-d3dd3)',
      'better-auth': '- Better Auth backend url: Your Better Auth service URL (e.g., https://your-domain.com/api/auth)',
      supabase:
        '- Supabase url: Your Supabase project URL (e.g., https://xxxxx.supabase.co)\n   - Supabase key: Your Supabase anon/public key',
      lootlocker: '- Enable LootLocker authentication in your Openfort dashboard',
      oidc: '- JWKS URL: URL to JSON Web Key Set for OIDC provider\n   - Verifiable Public Key: PEM encoded public key to verify JWT tokens (if JWKS URL not provided)\n   - Audience: Expected audience value in the ID token',
      custom:
        '- Authentication URL: Your custom authentication endpoint (e.g., https://your-domain.com/api/openfort/verify)\n' +
        '   - Headers: Comma-separated list of headers to include (e.g., X-Openfort-Secret: your-shared-secret)',
    }

    const hint = configHints[providerLower] || configHints.custom

    logger.error(
      `❌ Openfort OAuth Configuration Error:\n\n` +
        `The OAuth provider "${provider}" is not configured in your Openfort account.\n\n` +
        `To fix this:\n` +
        `1. Go to https://dashboard.openfort.io\n` +
        `2. Navigate to Configuration → Providers\n` +
        `3. Enable "${provider}" in the Third Party Authentication section\n` +
        `4. Configure the required fields:\n` +
        `   ${hint}\n` +
        `5. Click "Save"\n\n` +
        `See: https://www.openfort.io/docs/configuration/external-auth`
    )
  }
}
