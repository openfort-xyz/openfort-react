import { AccountTypeEnum } from '@openfort/openfort-js'

/**
 * Identifier for the Openfort embedded wallet connector.
 * Used when identifying the embedded wallet in connector lists.
 */
export const embeddedWalletId = 'xyz.openfort'

/** Default account type when none is specified in walletConfig or create options. */
export const DEFAULT_ACCOUNT_TYPE = AccountTypeEnum.EOA
