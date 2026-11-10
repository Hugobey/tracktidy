import { Analytics } from '@vercel/analytics/react';
import { useLocation } from 'react-router-dom';
import { redactAnalyticsUrl } from '../lib/vercel-analytics.ts';

export function VercelAnalytics() {
  const { pathname } = useLocation();
  return <Analytics path={pathname} route={pathname} beforeSend={redactAnalyticsUrl} />;
}
