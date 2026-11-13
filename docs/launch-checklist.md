# TrackTidy launch checklist

This file is configuration that lives outside the website. Do not change DNS or the hosting panel until the provider and the values below are confirmed.

## Status

`index.html` loads the supplied Google Tag Manager snippet for container `GTM-TWVDH6V3` on the public site. It does not load on localhost, 127.0.0.1, or ::1, so a local preview does not send that machine’s address. That container’s Google tag is `G-1DQDF61KJW`. It sends the first page view and does not forward later events. After Accept, the app sends page views and product events directly to that stream. Reject stops those hits. An explicit `VITE_GA_MEASUREMENT_ID` overrides the stream. Vercel Web Analytics loads on the public site and does not set a cookie. The same loopback hosts are dropped before a page view is sent. Turn it on in the Vercel project under Analytics, or the script has nowhere to record visits.

The legal notice is published from `PUBLISHED_NOTICE` in `src/legal/publisher.ts`. It names the brand, the entrepreneur individuel status, the contact emails, and Vercel Inc. as host. It does not print the publisher’s name, personal address, personal telephone, SIREN, or SIRET. No intra-EU VAT number is displayed. Namecheap is the registrar and is named only in the privacy policy, not on the legal notice.

## Environment

Copy `.env.example` to `.env` locally or set the variables in the host’s build settings.

- `VITE_SITE_URL` — `https://www.track-tidy.com`. The apex host redirects there. No path and no trailing slash. Rebuild after changing it. `public/robots.txt` and `public/sitemap.xml` must use the same origin.
- `VITE_GA_MEASUREMENT_ID` — optional override for the GA4 measurement ID. Empty uses `G-1DQDF61KJW`, the stream in the published container.

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

- Serve the site only over HTTPS. Redirect HTTP to HTTPS, and redirect `track-tidy.com` to `https://www.track-tidy.com`.
- Send HSTS once HTTPS is stable.
- The build writes an HTML file for each public route, with that page’s title, description, and canonical URL. `vercel.json` serves those files. Unknown paths stay on `404.html` with HTTP 404 and `noindex`.
- Google Search Console and the sitemap submission are account steps. The sitemap is `https://www.track-tidy.com/sitemap.xml`. Guides live at `/guides`, from `content/guides/*.mdx`, and the build adds each one to the sitemap. Product events reach `G-1DQDF61KJW` after Accept. Mark `file_downloaded` as a conversion in the GA4 property if that is the conversion you want.

## VAT position still to confirm

Do not add `FR14891239428` to the notice unless a later VIES check returns valid, or you confirm a different VAT position in writing. The notice currently says that no intra-EU VAT number is displayed. If the right statement is an exemption, such as franchise en base, replace only the `vatNotice` sentence. Do not invent that exemption here.
