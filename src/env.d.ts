/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_SITE_URL?: string;
}

declare const process: {
  readonly env: {
    readonly NEXT_PUBLIC_STRIPE_PAYMENT_LINK?: string;
  };
};

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
