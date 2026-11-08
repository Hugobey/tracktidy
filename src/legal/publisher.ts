/** Facts supplied for TrackTidy. Personal contact details stay off marketing pages. */
export const PUBLISHER = {
  brand: 'TrackTidy',
  status: 'Entrepreneur individuel (EI)',
  siren: '891239428',
  siret: '89123942800040',
  address: '27 rue neuve des Boulets, 75011 Paris, France',
  hello: 'hello@track-tidy.com',
  support: 'support@track-tidy.com',
  privacy: 'privacy@track-tidy.com',
} as const;

export type HostDetails = {
  name: string;
  address: string;
  phone: string;
};

/**
 * Details French law requires on a legal notice.
 * Null means unknown. Do not invent a value.
 */
export type LegalNoticeFacts = {
  /** Nom et prénom of the entrepreneur. The brand name is not a substitute. */
  legalName: string | null;
  phone: string | null;
  /** VAT number, or a confirmed statement of the VAT position. */
  vatNotice: string | null;
  /** RCS or RM details, or a confirmed statement of the register position. */
  registryNotice: string | null;
  host: HostDetails | null;
};

export const UNPUBLISHED_NOTICE: LegalNoticeFacts = {
  legalName: null,
  phone: null,
  vatNotice: null,
  registryNotice: null,
  host: null,
};

/**
 * Facts checked before publication.
 * The supplied number FR14891239428 is the check-digit form of this SIREN, but
 * the European Commission VIES service returned userError INVALID on
 * 2026-11-08. That number is not printed.
 * The host telephone is the organization number on the US Data Privacy
 * Framework record for Vercel Inc. (participant 6847). Vercel’s own privacy
 * notice of 1 June 2026 publishes the same address and no telephone.
 */
export const PUBLISHED_NOTICE: LegalNoticeFacts = {
  legalName: 'Hugo Blanchart',
  phone: '+33 7 77 37 25 07',
  vatNotice:
    'No intra-EU VAT number is shown. On 8 November 2026 the European Commission VIES service did not validate a VAT registration for this SIREN.',
  registryNotice:
    'Registered with the RNE (Répertoire national des entreprises) as an entrepreneur individuel. Not registered with the RCS.',
  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Avenue #4133, Covina, CA 91723, United States',
    phone: '+1 415 398 5463',
  },
};

export const LEGAL_NOTICE_WITHHELD = [
  'This legal notice is not published yet.',
  'A required identification detail is missing, so a partial notice is not shown on this page.',
  `Questions about the site can be sent to ${PUBLISHER.hello}.`,
] as const;

function filled(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function legalNoticeParagraphs(facts: LegalNoticeFacts): string[] | null {
  const host = facts.host;
  if (!filled(facts.legalName) || !filled(facts.phone) || !filled(facts.vatNotice) || !filled(facts.registryNotice)) {
    return null;
  }
  if (!host || !filled(host.name) || !filled(host.address) || !filled(host.phone)) return null;

  const name = facts.legalName.trim();
  return [
    `${PUBLISHER.brand} is a commercial brand published by ${name}, an ${PUBLISHER.status}.`,
    `Publication director: ${name}.`,
    `Address: ${PUBLISHER.address}.`,
    `Telephone: ${facts.phone.trim()}.`,
    `Email: ${PUBLISHER.hello}. Support: ${PUBLISHER.support}. Privacy: ${PUBLISHER.privacy}.`,
    `SIREN: ${PUBLISHER.siren}. SIRET: ${PUBLISHER.siret}.`,
    `VAT: ${facts.vatNotice.trim()}.`,
    `Registration: ${facts.registryNotice.trim()}.`,
    `The site is hosted by ${host.name.trim()}, ${host.address.trim()}. Host telephone: ${host.phone.trim()}.`,
  ];
}

export function legalNoticeIsPublished(facts: LegalNoticeFacts = UNPUBLISHED_NOTICE): boolean {
  return legalNoticeParagraphs(facts) !== null;
}
