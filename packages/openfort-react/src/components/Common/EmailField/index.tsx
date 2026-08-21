'use client'

import type React from 'react'
import { EmailIcon } from '../../../assets/icons.js'
import {
  ProviderIcon,
  ProviderInputInner,
  ProvidersButton as ProvidersButtonStyle,
} from '../../Pages/Providers/styles.js'

type EmailFieldProps = {
  value: string
  onChange: (email: string) => void
  placeholder?: string
  disabled?: boolean
  /** Submit on Enter when the caller has a valid value. */
  onSubmit?: () => void
}

/**
 * The email input styled exactly like the email login on the auth screens —
 * one rounded box with the envelope glyph on the right.
 */
const EmailField: React.FC<EmailFieldProps> = ({ value, onChange, placeholder, disabled, onSubmit }) => (
  <ProvidersButtonStyle>
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      noValidate
    >
      <ProviderInputInner>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="email"
          placeholder={placeholder ?? 'Enter your email'}
          autoComplete="email"
          disabled={disabled}
          formNoValidate
        />
        <ProviderIcon>
          <EmailIcon />
        </ProviderIcon>
      </ProviderInputInner>
    </form>
  </ProvidersButtonStyle>
)

export default EmailField
