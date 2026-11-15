import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { disableAnalytics } from '../lib/analytics.ts';
import { deviceFlag, DEVICE_QUERY, forgetOwnerDevice, rememberOwnerDevice } from '../lib/device.ts';
import { stopPostHog } from '../lib/posthog-client.ts';

/** Catches an in-app visit to `?tt-device=`. A full load is already handled before React. */
export function DeviceQuery() {
  const location = useLocation();

  useEffect(() => {
    const flag = deviceFlag(location.search);
    if (!flag) return;
    if (flag === 'owner') {
      rememberOwnerDevice();
      disableAnalytics();
      stopPostHog();
    } else {
      forgetOwnerDevice();
    }
    const params = new URLSearchParams(location.search);
    params.delete(DEVICE_QUERY);
    const search = params.toString();
    window.location.replace(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  }, [location.hash, location.pathname, location.search]);

  return null;
}
