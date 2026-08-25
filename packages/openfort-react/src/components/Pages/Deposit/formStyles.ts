import type { CSSProperties } from 'react'

/** Shared inline styles for the Deposit crypto/exchange forms (ConnectKit CSS vars). */

export const field: CSSProperties = { display: 'grid', gap: 6, fontSize: 13, textAlign: 'left' }

/** Deposit address — kept to a single line so the full address reads cleanly. */
export const codeStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 12,
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textAlign: 'center',
}

/** "Your deposit address" label above the address box. */
export const depositAddressLabel: CSSProperties = {
  marginTop: 14,
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'left',
  color: 'var(--ck-body-color, #1a1a2e)',
}

/** Shadow card around the deposit address + copy button. */
export const addressBox: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 6,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--ck-body-background, #fff)',
  border: '1px solid var(--ck-body-divider, #ededed)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
}

/** Chain + token selectors side by side. */
export const twoCol: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }

/** Full-width wallet row for the one-column "Transfer from wallet" deeplink list. */
export const walletListBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'center',
  padding: '14px 16px',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  background: 'var(--ck-secondary-button-background, #f3f3f5)',
  color: 'var(--ck-body-color, #1a1a2e)',
  border: '1px solid var(--ck-body-divider, #e4e4e7)',
}

/** Collapsible "Details" panel (min / fee / processing / max). */
export const detailsBox: CSSProperties = {
  marginTop: 14,
}

export const detailsToggle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '6px 0',
  color: 'var(--ck-body-color, #1a1a2e)',
  fontSize: 14,
  fontWeight: 600,
}

export const detailsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontSize: 13,
}

export const detailsLabel: CSSProperties = { color: 'var(--ck-body-color-muted, #6b7280)' }
export const detailsValue: CSSProperties = { color: 'var(--ck-body-color, #1a1a2e)' }
export const chevron: CSSProperties = { color: 'var(--ck-body-color-muted, #6b7280)', fontSize: 12 }
