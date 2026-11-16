import { useEffect } from 'react';
import { useConsent } from './consent-context.ts';
import { bindPostHogClient, stopPostHog } from '../lib/posthog-client.ts';
import { posthogHost, posthogKey, stripUrlQuery } from '../lib/posthog-config.ts';
import { posthogCaptureAllowed } from '../lib/posthog.ts';

const URL_PROPERTIES = ['$current_url', '$referrer', '$session_entry_url', '$initial_current_url'] as const;

export function PostHogAnalytics() {
  const { status } = useConsent();

  useEffect(() => {
    if (!posthogCaptureAllowed()) {
      stopPostHog();
      return undefined;
    }
    const key = posthogKey();
    const host = posthogHost();
    if (!key || !host) return undefined;
    let cancelled = false;
    void import('posthog-js').then((module) => {
      if (cancelled || !posthogCaptureAllowed()) return;
      const posthog = module.default;
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: host,
          defaults: '2026-08-30',
          logs: {
            serviceName: 'tracktidy-web',
            environment: import.meta.env.MODE,
          },
          capture_exceptions: {
            capture_unhandled_errors: true,
            capture_unhandled_rejections: true,
            capture_console_errors: false,
          },
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
      bindPostHogClient(posthog);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
