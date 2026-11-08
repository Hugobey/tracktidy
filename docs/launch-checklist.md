# TrackTidy launch checklist

This file is configuration that lives outside the website. Do not change DNS or the hosting panel until the provider and the values below are confirmed.

## Status

`index.html` loads the supplied Google Tag Manager snippet for container `GTM-TWVDH6V3` on every page. That is not the official container bootstrap: it does not push `gtm.start`. The optional Google Analytics 4 script still waits until a visitor presses Accept and `VITE_GA_MEASUREMENT_ID` is a GA4 id (`G-…`). Reject does not load that Analytics script.

The legal notice is published from `PUBLISHED_NOTICE` in `src/legal/publisher.ts`. It names Hugo Blanchart, the Paris address, the telephone, SIREN, SIRET, RNE registration, and Vercel Inc. as host. The supplied VAT number is not printed: on 8 November 2026 the European Commission VIES service reported it as not valid. Namecheap is the registrar and is named only in the privacy policy, not on the legal notice.

## Environment

Copy `.env.example` to `.env` locally or set the variables in the host’s build settings.

- `VITE_SITE_URL` — `https://track-tidy.com` unless the live host is different. No path and no trailing slash. Rebuild after changing it, and update `public/robots.txt` and `public/sitemap.xml` if the host name changes.
- `VITE_GA_MEASUREMENT_ID` — the GA4 measurement ID. Leave it empty until the property exists.

## Google Analytics 4

Create one GA4 property and one web stream for the live origin.

Before the measurement ID is added to the build:

- Data retention: set event data to 2 months.
- Turn off Google signals.
- Enhanced measurement: turn off “File downloads” so Google does not collect filenames. Turn off “Page changes based on browser history events”. The site sends page views itself. Leaving the history event on will count each navigation twice.
- Confirm the stream is not linked to Google Ads.

The site sets `send_page_view` to false, keeps ad storage denied, and sends only the events documented in the privacy policy. Parameters do not include filenames, tag values, or audio.

## Email

`hello@`, `support@`, and `privacy@track-tidy.com` should be aliases to the existing inbox. No extra addresses.

Add these DNS records only after the mailbox provider gives you the exact values. The values below are the checks, not records to copy.

- SPF: one TXT record on the root domain that authorizes only the servers that actually send mail. A domain can have only one SPF record.
- DKIM: enable signing in the mailbox provider and publish the selector TXT records it displays.
- DMARC: start with a TXT record on `_dmarc.track-tidy.com`. A monitoring policy such as `p=none` with a report address is the usual first step. Move to `p=quarantine` or `p=reject` after the reports look right.

## Hosting

The legal notice identifies the host as Vercel Inc. The repository still has no deployment project configured. Before launch:

- Serve the site only over HTTPS. Redirect HTTP to HTTPS, and redirect either `www` or the apex host to the single origin used in `VITE_SITE_URL`.
- Send HSTS once HTTPS is stable.
- Map unknown paths to the app so the in-app 404 page can render, or serve `404.html` with HTTP status 404. A host that rewrites every path to `index.html` will return HTTP 200 for missing pages until its own 404 rule is added.
- The static `index.html` shell carries the homepage title and canonical URL. Client-side routing replaces those tags after JavaScript runs. Crawlers that do not run JavaScript will see the homepage metadata on every address.

## VAT position still to confirm

Do not add `FR14891239428` to the notice unless a later VIES check returns valid, or you confirm a different VAT position in writing. The notice currently says that no intra-EU VAT number is shown. If the right statement is an exemption, such as franchise en base, replace only the `vatNotice` sentence. Do not invent that exemption here.
