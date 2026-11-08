import { useEffect } from 'react';
import { trackPageView } from '../lib/analytics.ts';
import { canonicalUrl } from '../lib/site.ts';
import { useConsent } from './consent-context.ts';

type Props = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  jsonLd?: Record<string, unknown> | null;
};

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export function SiteHead({ title, description, path, index = true, jsonLd = null }: Props) {
  const { status } = useConsent();
  const structured = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    document.title = title;
    const canonical = canonicalUrl(path);
    const robots = index ? 'index,follow' : 'noindex,nofollow';
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robots);
    upsertCanonical(canonical);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'TrackTidy');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', `${canonicalUrl('/').replace(/\/$/, '')}/og.png`);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', `${canonicalUrl('/').replace(/\/$/, '')}/og.png`);

    const existing = document.getElementById('tracktidy-ld');
    if (structured) {
      const script = existing ?? document.createElement('script');
      script.id = 'tracktidy-ld';
      script.setAttribute('type', 'application/ld+json');
      script.textContent = structured;
      if (!existing) document.head.appendChild(script);
    } else {
      existing?.remove();
    }

    trackPageView(path);
  }, [description, index, path, status, structured, title]);

  return null;
}
