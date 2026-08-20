import { describe, expect, it } from 'vitest'
import {
  attestationRequired,
  carfIdentifierForCountry,
  documentsRequired,
  identifierLabel,
  pendingIdentifierTypes,
  stepUpFor,
} from '../hooks/openfort/euIdentifiers'
import type { StripeIdentifierRequirements } from '../hooks/openfort/stripeCryptoOnramp'

const requirements = (over: Partial<StripeIdentifierRequirements> = {}): StripeIdentifierRequirements => ({
  identifiers: [],
  alternatives: [],
  carf_tin_required: false,
  ...over,
})

describe('pendingIdentifierTypes', () => {
  it('asks for exactly what Stripe listed', () => {
    const reqs = requirements({
      identifiers: [
        { type: 'de_stn', regulation: 'eu_carf' },
        { type: 'pl_pesel', regulation: 'eu_mica' },
      ],
    })
    expect(pendingIdentifierTypes(reqs, 'DE')).toEqual(['de_stn', 'pl_pesel'])
  })

  it('asks for nothing when nothing is outstanding', () => {
    expect(pendingIdentifierTypes(requirements(), 'DE')).toEqual([])
  })

  it('adds the country tax number when CARF requires one', () => {
    expect(pendingIdentifierTypes(requirements({ carf_tin_required: true }), 'ES')).toEqual(['es_nif'])
    expect(pendingIdentifierTypes(requirements({ carf_tin_required: true }), 'FR')).toEqual(['fr_spi'])
  })

  it('skips the CARF tax number for a country that has none', () => {
    expect(pendingIdentifierTypes(requirements({ carf_tin_required: true }), 'US')).toEqual([])
  })

  it('asks once when the CARF number is already in the list', () => {
    const reqs = requirements({
      identifiers: [{ type: 'de_stn', regulation: 'eu_carf' }],
      carf_tin_required: true,
    })
    expect(pendingIdentifierTypes(reqs, 'DE')).toEqual(['de_stn'])
  })

  it('collapses an alternative group to one field instead of asking for both', () => {
    // Malta accepts an identity card OR a passport.
    const reqs = requirements({
      identifiers: [{ type: 'mt_nic', regulation: 'eu_mica' }],
      alternatives: [{ original_missing_identifiers: ['mt_nic'], alternative_missing_identifiers: ['mt_pp'] }],
    })
    expect(pendingIdentifierTypes(reqs, 'MT')).toEqual(['mt_pp'])
  })

  it('falls back to the original when a group offers no alternative', () => {
    const reqs = requirements({
      identifiers: [{ type: 'it_cf', regulation: 'eu_mica' }],
      alternatives: [{ original_missing_identifiers: ['it_cf'], alternative_missing_identifiers: [] }],
    })
    expect(pendingIdentifierTypes(reqs, 'IT')).toEqual(['it_cf'])
  })
})

describe('attestationRequired', () => {
  it('never re-asks a buyer who already declared', () => {
    expect(attestationRequired(requirements({ carf_tin_required: true }), ['attestation'])).toBe(false)
  })

  it('asks when the provider says the declaration is still outstanding', () => {
    expect(attestationRequired(requirements({ carf_tin_required: true }), ['identifiers'])).toBe(true)
    // Authoritative even when the CARF flag is clear.
    expect(attestationRequired(requirements(), [])).toBe(true)
  })

  it('falls back to the CARF flag when the buyer state is unknown', () => {
    expect(attestationRequired(requirements({ carf_tin_required: true }), undefined)).toBe(true)
    expect(attestationRequired(requirements(), undefined)).toBe(false)
  })
})

describe('documentsRequired', () => {
  it('asks a buyer who has cleared the identity form but owes documents', () => {
    expect(documentsRequired('L1', ['identifiers'])).toBe(true)
  })

  it('does not ask once documents are provided', () => {
    expect(documentsRequired('L1', ['documents'])).toBe(false)
  })

  it('never demands documents before the identity form', () => {
    // A buyer at L0 has given no name yet — asking for a passport is absurd.
    expect(documentsRequired('L0', [])).toBe(false)
    expect(documentsRequired('REQUIRES_KYC', [])).toBe(false)
  })

  it('does not ask at the ceiling, nor while a review is pending', () => {
    expect(documentsRequired('L2', [])).toBe(false)
    expect(documentsRequired('PENDING', [])).toBe(false)
  })

  it('stays silent when the buyer state is unknown — the commit still decides', () => {
    expect(documentsRequired('L1', undefined)).toBe(false)
    expect(documentsRequired(undefined, undefined)).toBe(false)
  })
})

describe('stepUpFor', () => {
  it('sends an unverified buyer to the identity form, not to documents', () => {
    // The bug this encodes: a first-time buyer was shown the L1 identity form
    // before they had exceeded anything at all.
    expect(stepUpFor('L0')).toEqual({ step: 'kyc' })
    expect(stepUpFor('REQUIRES_KYC')).toEqual({ step: 'kyc' })
    expect(stepUpFor(undefined)).toEqual({ step: 'kyc' })
  })

  it('sends an L1 buyer to documents', () => {
    expect(stepUpFor('L1')).toEqual({ step: 'documents' })
  })

  it('explains the ceiling instead of sending the buyer nowhere', () => {
    const result = stepUpFor('L2')
    expect(result).toHaveProperty('blocked')
    expect('blocked' in result && result.blocked).toMatch(/smaller amount/i)
  })

  it('never re-asks for identity while a review is in flight or refused', () => {
    // Re-showing the form would ask the buyer to redo work sitting with the
    // provider — neither state is something another form can fix.
    for (const level of ['PENDING', 'REJECTED']) {
      const result = stepUpFor(level)
      expect(result).toHaveProperty('blocked')
      expect(result).not.toHaveProperty('step')
    }
  })
})

describe('identifier lookups', () => {
  it('labels known types and passes unknown ones through', () => {
    expect(identifierLabel('de_stn')).toBe('Steuer-ID')
    expect(identifierLabel('xx_unknown')).toBe('xx_unknown')
  })

  it('resolves the CARF type case-insensitively', () => {
    expect(carfIdentifierForCountry('nl')).toBe('nl_bsn')
    expect(carfIdentifierForCountry('NL')).toBe('nl_bsn')
    expect(carfIdentifierForCountry('JP')).toBeNull()
  })
})
