import type { CSSProperties } from 'react'

/** Shared inline styles for the Deposit crypto/exchange forms (ConnectKit CSS vars). */

export const field: CSSProperties = { display: 'grid', gap: 6, fontSize: 13, textAlign: 'left' }

/** A control-styled box holding a logo + a borderless select. */
export const selectWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--ck-body-divider, #e4e4e7)',
  background: 'var(--ck-body-background-secondary, #fafafa)',
}

// Native select keeps its dropdown arrow (no appearance:none).
export const bareSelect: CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: 14,
  outline: 'none',
  cursor: 'pointer',
}

export const logoImg: CSSProperties = { width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }

export const codeStyle: CSSProperties = { fontSize: 12, wordBreak: 'break-all' }

/** Shadow card around the deposit address + copy button. */
export const addressBox: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 12,
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--ck-body-background, #fff)',
  border: '1px solid var(--ck-body-divider, #ededed)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
}

/** "──  or  ──" separator between the scan/copy path and the open-wallet path. */
export const orRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 4px' }
export const orLine: CSSProperties = { flex: 1, height: 1, background: 'var(--ck-body-divider, #ededed)' }
export const orText: CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--ck-body-color-muted, #6b7280)' }

/** Chain + token selectors side by side. */
export const twoCol: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }

/** Wrapping row of wallet deeplink buttons at the bottom of the crypto flow. */
export const deeplinkRow: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }

/** Themed (secondary-button) deeplink button — matches the hub options, visible in both modes. */
export const deeplinkBtn: CSSProperties = {
  flex: '1 1 130px',
  textAlign: 'center',
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  background: 'var(--ck-secondary-button-background, #f3f3f5)',
  color: 'var(--ck-body-color, #1a1a2e)',
  border: '1px solid var(--ck-body-divider, #e4e4e7)',
}

/** Full-width wallet row for the one-column "Transfer crypto from wallet" sub-page. */
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
