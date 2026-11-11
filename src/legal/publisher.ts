/** Public publisher facts. Personal name, home address, telephone, SIREN, and SIRET stay off the site. */
export const PUBLISHER = {
  brand: 'TrackTidy',
  status: 'entrepreneur individuel',
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
 * Details the public legal notice is allowed to show.
 * Do not add the publisher’s name, personal address, personal telephone, SIREN, or SIRET.
 */
export type LegalNoticeFacts = {
  /** VAT number, or a statement that none is displayed. Never print an unchecked number. */
  vatNotice: string | null;
  /** Register position, without a registration number. */
  registryNotice: string | null;
  host: HostDetails | null;
};

export const UNPUBLISHED_NOTICE: LegalNoticeFacts = {
  vatNotice: null,
  registryNotice: null,
  host: null,
};

/**
 * Host identity is Vercel’s, not the publisher’s.
 * The host telephone is the organization number on the US Data Privacy
 * Framework record for Vercel Inc. (participant 6847).
 * Do not print an intra-EU VAT number here unless a later check shows it is valid.
 */
export const PUBLISHED_NOTICE: LegalNoticeFacts = {
  vatNotice: 'No intra-EU VAT number is displayed.',
  registryNotice: 'The publisher is an entrepreneur individuel and is not registered with the RCS.',
  host: {
    name: 'Vercel Inc.',
    address: '440 N Barranca Avenue #4133, Covina, CA 91723, United States',
    phone: '+1 415 398 5463',
  },
};

export const LEGAL_NOTICE_WITHHELD = [
  'This legal notice is not published yet.',
  'A required hosting detail is missing, so a partial notice is not shown on this page.',
  `Questions about the site can be sent to ${PUBLISHER.hello}.`,
] as const;

function filled(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function legalNoticeParagraphs(facts: LegalNoticeFacts): string[] | null {
  const host = facts.host;
  if (!filled(facts.vatNotice) || !filled(facts.registryNotice)) return null;
  if (!host || !filled(host.name) || !filled(host.address) || !filled(host.phone)) return null;

  return [
    `${PUBLISHER.brand} is a commercial brand published by an ${PUBLISHER.status}.`,
    `Publication contact: ${PUBLISHER.hello}.`,
    `Email: ${PUBLISHER.hello}. Support: ${PUBLISHER.support}. Privacy: ${PUBLISHER.privacy}.`,
    `VAT: ${facts.vatNotice.trim()}`,
    `Registration: ${facts.registryNotice.trim()}`,
    `The site is hosted by ${host.name.trim()}, ${host.address.trim()}. Host telephone: ${host.phone.trim()}.`,
  ];
}

export function legalNoticeIsPublished(facts: LegalNoticeFacts = UNPUBLISHED_NOTICE): boolean {
  return legalNoticeParagraphs(facts) !== null;
}
