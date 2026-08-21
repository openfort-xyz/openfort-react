import { FundingMethod, type WalletPayDraft, type WalletPayIdentity } from '../../components/Openfort/types.js'

/**
 * Helpers for the Coinbase native wallet-pay (Apple/Google Pay) identity the
 * widget assembles before committing. The method alone only says wallet pay
 * MAY need it: the server resolves `apple_pay`/`google_pay` to the native
 * sheet for US buyers on a project with Coinbase CDP creds and to the hosted
 * checkout (no identity) everywhere else — the resolved angle decides.
 */

/** True for the wallet-pay methods that MAY commit a Coinbase native order. */
export function isWalletPayMethod(method: FundingMethod): boolean {
  return method === FundingMethod.APPLE_PAY || method === FundingMethod.GOOGLE_PAY
}

/** True once every field the native commit needs is present and non-empty. */
export function isCompleteWalletPay(draft: WalletPayDraft | null | undefined): draft is WalletPayIdentity {
  return !!draft && !!draft.email && !!draft.phoneNumber && !!draft.phoneNumberVerifiedAt && !!draft.agreementAcceptedAt
}
