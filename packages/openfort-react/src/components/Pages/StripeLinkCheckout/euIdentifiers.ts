import type { StripeIdentifierRequirements } from '../../../hooks/openfort/stripeCryptoOnramp'

/**
 * National identifiers Stripe collects from EU buyers, under two regimes:
 * MiCA (markets in crypto-assets) and CARF (crypto-asset reporting framework).
 * Which ones a given buyer owes comes from `getMissingIdentifiers` — this table
 * only supplies the human label and, for CARF's tax number, the type to send
 * for the buyer's country.
 *
 * Mirrors the table in Stripe's official crypto-embedded-components sample.
 */

/** Label per identifier type, shown above the input the buyer fills in. */
const IDENTIFIER_NAMES: Record<string, string> = {
  // MiCA
  ee_ik: 'Isikukood (personal identification code)',
  es_nif: 'Tax identification number (NIF)',
  is_kt: 'Kennitala (personal identification code)',
  it_cf: 'Codice fiscale',
  mt_nic: 'National identity card number',
  mt_pp: 'Passport number',
  pl_pesel: 'PESEL number',
  pl_nip: 'NIP',
  // CARF tax numbers
  at_stn: 'Steuernummer',
  be_nrn: 'National registration number (NRN)',
  bg_ucn: 'Unified civil number',
  hr_oib: 'OIB',
  cy_tic: 'Tax identification code (TIC)',
  cz_rc: 'Rodné číslo',
  dk_cpr: 'Personnummer (CPR)',
  fi_hetu: 'Henkilötunnus (HETU)',
  fr_spi: 'Numéro fiscal de référence (SPI)',
  fr_nir: 'NIR (social security number)',
  de_stn: 'Steuer-ID',
  gr_afm: 'Tax identification number (AFM)',
  hu_ad: 'Adóazonosító',
  ie_ppsn: 'Personal public service number (PPSN)',
  lv_pk: 'Personas kods',
  lt_ak: 'Asmens kodas',
  lu_nif: 'NIF',
  nl_bsn: 'Citizen service number (BSN)',
  pt_nif: 'NIF',
  ro_cnp: 'Codul numeric personal (CNP)',
  sk_rc: 'Rodné číslo',
  si_pin: 'Personal identification number (EMŠO)',
  se_pin: 'Personnummer',
}

/**
 * The CARF tax-number type for a country. Consulted only when Stripe answers
 * `carf_tin_required` — that flag names no type, so the country picks it.
 */
const CARF_TYPE_BY_COUNTRY: Record<string, string> = {
  AT: 'at_stn',
  BE: 'be_nrn',
  BG: 'bg_ucn',
  HR: 'hr_oib',
  CY: 'cy_tic',
  CZ: 'cz_rc',
  DK: 'dk_cpr',
  EE: 'ee_ik',
  ES: 'es_nif',
  FI: 'fi_hetu',
  FR: 'fr_spi',
  DE: 'de_stn',
  GR: 'gr_afm',
  HU: 'hu_ad',
  IE: 'ie_ppsn',
  IT: 'it_cf',
  LV: 'lv_pk',
  LT: 'lt_ak',
  LU: 'lu_nif',
  MT: 'mt_nic',
  NL: 'nl_bsn',
  PL: 'pl_pesel',
  PT: 'pt_nif',
  RO: 'ro_cnp',
  SK: 'sk_rc',
  SI: 'si_pin',
  SE: 'se_pin',
}

/** Human label for an identifier type; falls back to the raw type. */
export const identifierLabel = (type: string): string => IDENTIFIER_NAMES[type] ?? type

/** The CARF tax-number type for a country, or null where CARF doesn't apply. */
export const carfIdentifierForCountry = (country: string): string | null =>
  CARF_TYPE_BY_COUNTRY[country.toUpperCase()] ?? null

/**
 * The identifier types still outstanding: everything Stripe listed, plus the
 * buyer country's tax number when CARF demands one (that flag names no type).
 * Where Stripe offers alternatives it accepts any member of the group, so we
 * ask for one — the group's originals drop out to avoid asking twice.
 */
export function pendingIdentifierTypes(requirements: StripeIdentifierRequirements, country: string): string[] {
  const supersededByAlternative = new Set(requirements.alternatives.flatMap((g) => g.original_missing_identifiers))
  const types = requirements.identifiers.map((i) => i.type).filter((t) => !supersededByAlternative.has(t))
  for (const group of requirements.alternatives) {
    const chosen = group.alternative_missing_identifiers[0] ?? group.original_missing_identifiers[0]
    if (chosen) types.push(chosen)
  }
  if (requirements.carf_tin_required) {
    const carf = carfIdentifierForCountry(country)
    if (carf) types.push(carf)
  }
  return [...new Set(types)]
}

/**
 * CARF also wants a self-declaration, which Stripe renders as its own element.
 * `carf_tin_required` is the only signal this widget has for it — the
 * authoritative `provided_fields` list lives on the customer endpoint, which we
 * don't read, so a buyer who already declared may see the element again.
 */
export const attestationRequired = (requirements: StripeIdentifierRequirements): boolean =>
  requirements.carf_tin_required
