'use client'

import type React from 'react'
import styled from '../../../styles/styled/index.js'

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
`

const Box = styled.button<{ $checked: boolean }>`
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  margin: 2px 0 0;
  padding: 0;
  border-radius: 6px;
  border: 2px solid
    ${({ $checked }) => ($checked ? 'var(--ck-accent-color, #1a88f8)' : 'var(--ck-body-divider, rgba(0, 0, 0, 0.1))')};
  background: ${({ $checked }) => ($checked ? 'var(--ck-accent-color, #1a88f8)' : 'transparent')};
  color: var(--ck-accent-text-color, #ffffff);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

const Label = styled.span`
  font-size: 14px;
  line-height: 1.45;
  color: var(--ck-body-color-muted, rgba(0, 0, 0, 0.5));
  a {
    color: var(--ck-body-color, inherit);
    text-decoration: underline;
  }
`

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M2.5 6.2 4.8 8.5 9.5 3.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type CheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}

/**
 * A themed consent checkbox — the package ships no checkbox primitive. Only the
 * box toggles, so links inside the label stay independently clickable.
 */
const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, disabled, children }) => (
  <Row>
    <Box
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      $checked={checked}
      onClick={() => onChange(!checked)}
    >
      {checked && <CheckIcon />}
    </Box>
    <Label>{children}</Label>
  </Row>
)

export default Checkbox
