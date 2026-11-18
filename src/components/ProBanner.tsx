import { PRO_COPY } from '../lib/pro.ts';
import { usePro } from './pro-context.ts';

export function ProBanner() {
  const pro = usePro();
  if (pro.checkoutToast) {
    return (
      <p className="pro-banner" role="status">
        <span>{PRO_COPY.checkoutToast}</span>
        <button className="btn btn-quiet" type="button" onClick={pro.dismissCheckoutToast}>
          Close
        </button>
      </p>
    );
  }
  if (!pro.banner) return null;
  return (
    <p className="pro-banner" role="status">
      <span>{PRO_COPY.banner}</span>
      <button className="btn btn-quiet" type="button" onClick={pro.dismissBanner}>
        Close
      </button>
    </p>
  );
}
