const CUSTOMERS = 'https://api.stripe.com/v1/customers';
const SESSIONS = 'https://api.stripe.com/v1/checkout/sessions';
const CHARGES = 'https://api.stripe.com/v1/charges';

function listData(body) {
  return body && Array.isArray(body.data) ? body.data : [];
}

function sessionPaid(session) {
  return session?.payment_status === 'paid';
}

function chargePaid(charge) {
  return charge?.paid === true && charge?.status === 'succeeded' && charge?.refunded !== true;
}

/**
 * True when Stripe has a paid Checkout Session or a succeeded Charge for this email.
 * The secret is passed in by the server. Do not import this from client code with a key.
 */
export async function emailHasPaid(email, secret, fetchImpl = fetch) {
  const headers = { Authorization: `Bearer ${secret}` };

  async function stripeGet(url) {
    const response = await fetchImpl(url, { headers });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error('stripe');
      error.status = response.status;
      throw error;
    }
    return json;
  }

  async function stripeGetSoft(url) {
    try {
      return await stripeGet(url);
    } catch (error) {
      if (error && (error.status === 400 || error.status === 404)) return { data: [] };
      throw error;
    }
  }

  const byEmail = await stripeGetSoft(
    `${SESSIONS}?${new URLSearchParams({
      'customer_details[email]': email,
      status: 'complete',
      limit: '20',
    }).toString()}`,
  );
  if (listData(byEmail).some(sessionPaid)) return true;

  const customers = await stripeGet(`${CUSTOMERS}?${new URLSearchParams({ email, limit: '10' }).toString()}`);
  for (const customer of listData(customers)) {
    const id = typeof customer?.id === 'string' ? customer.id : '';
    if (!id) continue;
    const charges = await stripeGet(`${CHARGES}?${new URLSearchParams({ customer: id, limit: '20' }).toString()}`);
    if (listData(charges).some(chargePaid)) return true;
    const sessions = await stripeGet(`${SESSIONS}?${new URLSearchParams({ customer: id, limit: '20' }).toString()}`);
    if (listData(sessions).some(sessionPaid)) return true;
  }

  const found = await stripeGetSoft(
    `${CHARGES}/search?${new URLSearchParams({
      query: `billing_details.email:'${email}' AND status:'succeeded'`,
      limit: '5',
    }).toString()}`,
  );
  return listData(found).some(chargePaid);
}
