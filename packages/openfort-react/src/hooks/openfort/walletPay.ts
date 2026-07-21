import { FundingMethod, type WalletPayDraft, type WalletPayIdentity } from '../../components/Openfort/types'

/** The buyer-identity fields the wallet-pay flow reads off the logged-in user. */
type WalletPayUser = { email?: string; phoneNumber?: string; phoneNumberVerified?: boolean }

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

/**
 * Whether the OTP-capture screen is needed, or the buyer's existing Openfort
 * identity already satisfies the native commit. We can skip capture only when
 * the user has an email and an already-verified phone; otherwise the widget must
 * gather and OTP-verify the missing piece.
 */
export function needsWalletPayCapture(user: WalletPayUser | undefined | null): boolean {
  return !(user?.email && user?.phoneNumber && user?.phoneNumberVerified)
}
