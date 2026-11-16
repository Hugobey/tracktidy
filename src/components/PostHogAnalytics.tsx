import { useEffect } from 'react';
import { useConsent } from './consent-context.ts';
import { bindPostHogClient, posthogLogger, stopPostHog } from '../lib/posthog-client.ts';
import { posthogHost, posthogKey, stripUrlQuery } from '../lib/posthog-config.ts';
import { posthogCaptureAllowed } from '../lib/posthog.ts';

const URL_PROPERTIES = ['$current_url', '$referrer', '$session_entry_url', '$initial_current_url'] as const;

export function PostHogAnalytics() {
  const { status } = useConsent();

  useEffect(() => {
    const key = posthogKey();
    const host = posthogHost();
    if (!key || !host) {
      if (import.meta.env.DEV) {
        const variable = key ? 'VITE_POSTHOG_HOST' : 'VITE_POSTHOG_KEY';
        console.error(
          `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
        );
      }
      return undefined;
    }
    if (!posthogCaptureAllowed()) {
      stopPostHog();
      return undefined;
    }
    let cancelled = false;
    void import('posthog-js').then((module) => {
      if (cancelled || !posthogCaptureAllowed()) return;
      const posthog = module.default;
      if (!posthog.__loaded) {
        posthog.init(key, {
          api_host: host,
          capture_pageview: 'history_change',
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
      posthogLogger.info('posthog_log_capture_ready', { surface: 'web' });
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
