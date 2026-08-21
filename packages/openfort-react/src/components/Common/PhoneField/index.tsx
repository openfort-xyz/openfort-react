'use client'

import type React from 'react'
import { type CountryIso2, defaultCountries, PhoneInput, parseCountry } from 'react-international-phone'
import { PhoneIcon } from '../../../assets/icons.js'
import {
  ProviderIcon,
  ProviderInputInner,
  ProvidersButton as ProvidersButtonStyle,
} from '../../Pages/Providers/styles.js'

type PhoneFieldProps = {
  /** E.164 value (react-international-phone emits E.164 on change). */
  value: string
  onChange: (phone: string) => void
  /**
   * Restrict the selector to these countries (iso2) — e.g. a rail that only
   * accepts US numbers passes `['us']`. Omit for the full list.
   */
  countries?: CountryIso2[]
  defaultCountry?: CountryIso2
  placeholder?: string
  disabled?: boolean
}

/**
 * The phone input styled exactly like the phone login on the auth screens —
 * one rounded box with the country-code selector on the left and the phone
 * glyph on the right.
 */
const PhoneField: React.FC<PhoneFieldProps> = ({
  value,
  onChange,
  countries,
  defaultCountry = 'us',
  placeholder,
  disabled,
}) => {
  const countryList = countries
    ? defaultCountries.filter((country) => countries.includes(parseCountry(country).iso2))
    : undefined
  return (
    <ProvidersButtonStyle>
      <ProviderInputInner>
        <div style={{ width: '100%' }}>
          <PhoneInput
            value={value}
            onChange={onChange}
            defaultCountry={defaultCountry}
            {...(countryList ? { countries: countryList } : {})}
            placeholder={placeholder ?? 'Enter your phone'}
            disabled={disabled}
            style={
              {
                '--react-international-phone-height': '56px',
                '--react-international-phone-text-color': 'var(--ck-body-color)',
                '--react-international-phone-background-color': 'var(--ck-secondary-button-background)',
                '--react-international-phone-country-selector-background-color':
                  'var(--ck-secondary-button-background)',
                '--react-international-phone-selected-dropdown-item-background-color':
                  'var(--ck-secondary-button-hover-background)',
                '--react-international-phone-country-selector-background-color-hover':
                  'var(--ck-secondary-button-hover-background)',
                '--react-international-phone-font-size': '16px',
                paddingLeft: '4px',
              } as React.CSSProperties
            }
          />
        </div>
        <ProviderIcon>
          <PhoneIcon />
        </ProviderIcon>
      </ProviderInputInner>
    </ProvidersButtonStyle>
  )
}

export default PhoneField
