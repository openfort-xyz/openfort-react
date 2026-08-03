'use client'

import type React from 'react'
import { type CountryIso2, defaultCountries, PhoneInput, parseCountry } from 'react-international-phone'
import { FieldLabel, FieldWrap } from '../LabeledField'

type PhoneFieldProps = {
  label: string
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
 * A labeled phone input with a country-code selector — the same
 * react-international-phone control the phone login uses, themed with the
 * widget variables and sized to match {@link LabeledField}'s compact inputs.
 */
const PhoneField: React.FC<PhoneFieldProps> = ({
  label,
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
    <FieldWrap>
      <FieldLabel>{label}</FieldLabel>
      <PhoneInput
        value={value}
        onChange={onChange}
        defaultCountry={defaultCountry}
        {...(countryList ? { countries: countryList } : {})}
        placeholder={placeholder}
        disabled={disabled}
        style={
          {
            '--react-international-phone-height': '40px',
            '--react-international-phone-border-radius': 'var(--ck-secondary-button-border-radius)',
            '--react-international-phone-border-color': 'transparent',
            '--react-international-phone-text-color': 'var(--ck-body-color)',
            '--react-international-phone-background-color': 'var(--ck-input-background)',
            '--react-international-phone-country-selector-background-color': 'var(--ck-input-background)',
            '--react-international-phone-selected-dropdown-item-background-color':
              'var(--ck-secondary-button-hover-background)',
            '--react-international-phone-country-selector-background-color-hover':
              'var(--ck-secondary-button-hover-background)',
            '--react-international-phone-font-size': '14px',
          } as React.CSSProperties
        }
      />
    </FieldWrap>
  )
}

export default PhoneField
