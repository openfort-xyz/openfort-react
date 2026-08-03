'use client'

import type React from 'react'
import styled from '../../../styles/styled'
import type { InputProps } from '../Input/types'

const FieldWrap = styled.div`
  margin-top: 10px;
  text-align: left;
`

const FieldLabel = styled.label`
  display: block;
  margin: 0 0 4px 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ck-body-color);
`

const CompactInput = styled.input`
  width: 100%;
  height: 40px;
  padding: 8px 12px;
  border-radius: var(--ck-secondary-button-border-radius);
  box-shadow: var(--ck-secondary-button-box-shadow);
  background: var(--ck-input-background);
  font-size: 14px;
  color: var(--ck-body-color);
  transition: all 0.2s;

  ::placeholder {
    color: var(--ck-body-color-muted);
  }

  &:focus {
    background: var(--ck-input-hover-background);
    box-shadow: var(--ck-secondary-button-hover-box-shadow);
  }
`

type LabeledFieldProps = InputProps & { label: string }

/**
 * A form input with its name above it — the compact variant used by the
 * funding screens' detail forms (contact, registration, identity), where
 * several fields stack and placeholders alone don't organize them.
 */
const LabeledField: React.FC<LabeledFieldProps> = ({ label, ...props }) => (
  <FieldWrap>
    <FieldLabel>{label}</FieldLabel>
    <CompactInput {...props} />
  </FieldWrap>
)

export default LabeledField
