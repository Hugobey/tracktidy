import { emailHasPaid } from './stripe-paid.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleCheckPro(emailRaw, secret, fetchImpl = fetch) {
  const email = String(emailRaw ?? '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.includes("'") || email.includes('\\')) {
    return { status: 400, body: { pro: false, error: 'Enter a valid email address.' } };
  }
  if (typeof secret !== 'string' || !secret.startsWith('sk_')) {
    return { status: 503, body: { pro: false, error: 'Pro restore is not connected on this build yet.' } };
  }
  try {
    const pro = await emailHasPaid(email, secret, fetchImpl);
    return { status: 200, body: { pro } };
  } catch {
    return { status: 502, body: { pro: false, error: 'Stripe could not be reached. Try again.' } };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ pro: false, error: 'Use a GET request.' });
    return;
  }
  const result = await handleCheckPro(req.query?.email, process.env.STRIPE_SECRET_KEY);
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
