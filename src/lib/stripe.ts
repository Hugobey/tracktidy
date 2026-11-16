/** Hosted Stripe Payment Link. The secret key never belongs in this file. */
export function stripePaymentUrl(email: string, raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:') return null;
    url.searchParams.set('prefilled_email', email.trim());
    return url.toString();
  } catch {
    return null;
  }
}

export function stripeCheckoutConfigured(raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK): boolean {
  return stripePaymentUrl('dj@example.com', raw) !== null;
}
