import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useConsent } from './consent-context.ts';
import { bindPostHogClient, stopPostHog } from '../lib/posthog-client.ts';
import { posthogHost, posthogKey, stripUrlQuery } from '../lib/posthog-config.ts';
import { posthogCaptureAllowed } from '../lib/posthog.ts';

const URL_PROPERTIES = ['$current_url', '$referrer', '$session_entry_url', '$initial_current_url'] as const;

export function PostHogAnalytics() {
  const { pathname } = useLocation();
  const { status } = useConsent();

  useEffect(() => {
    if (!posthogCaptureAllowed()) {
      stopPostHog();
      return undefined;
    }
    const key = posthogKey();
    if (!key) return undefined;
    let cancelled = false;
    void import('posthog-js').then((module) => {
      if (cancelled || !posthogCaptureAllowed()) return;
      const posthog = module.default;
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: posthogHost(),
          autocapture: false,
          rageclick: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          disable_surveys: true,
          disable_product_tours: true,
          disable_external_dependency_loading: true,
          capture_exceptions: false,
          capture_performance: false,
          capture_heatmaps: false,
          capture_dead_clicks: false,
          person_profiles: 'identified_only',
          advanced_disable_flags: true,
          advanced_disable_feature_flags: true,
          mask_all_text: true,
          mask_all_element_attributes: true,
          mask_personal_data_properties: true,
          cross_subdomain_cookie: false,
          before_send: (event) => {
            if (!posthogCaptureAllowed()) return null;
            const properties = { ...event.properties };
            for (const name of URL_PROPERTIES) {
              const value = properties[name];
              if (typeof value === 'string') properties[name] = stripUrlQuery(value);
            }
            return { ...event, properties };
          },
        });
      } else {
        posthog.opt_in_capturing();
      }
      posthog.capture('$pageview', {
        $current_url: `${window.location.origin}${pathname}`,
      });
      bindPostHogClient(posthog);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, status]);

  return null;
}
