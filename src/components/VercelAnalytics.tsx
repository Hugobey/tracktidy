import { Analytics } from '@vercel/analytics/react';
import { useLocation } from 'react-router-dom';
import { isLocalAnalyticsHost } from '../lib/analytics.ts';
import { isOwnerDevice } from '../lib/device.ts';
import { redactAnalyticsUrl } from '../lib/vercel-analytics.ts';

export function VercelAnalytics() {
  const { pathname } = useLocation();
  if (isLocalAnalyticsHost(window.location.hostname) || isOwnerDevice()) return null;
  return <Analytics path={pathname} route={pathname} beforeSend={redactAnalyticsUrl} />;
}
