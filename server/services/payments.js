// One-time /t26 top-ups via Stripe Checkout.
//
// The server owns the bundle catalogue (id → dollars + /t26), so a client can
// only ever name a bundle — never set its own price or payout. The flow:
//   1. POST /api/payments/checkout {bundle} → a Stripe Checkout Session; the
//      client redirects the browser to session.url.
//   2. The shopper pays on Stripe's hosted page.
//   3. Stripe calls POST /api/payments/webhook with checkout.session.completed;
//      we verify the signature and credit the buyer's /t26 via the ledger.
//
// Crediting happens ONLY on the signed webhook — never on the success redirect,
// which is unauthenticated and trivially forged. Stripe keys are optional: with
// none set the endpoints report "not configured" and the rest of the app runs
// unchanged (local dev, and the site before keys are wired).
import Stripe from 'stripe';
import { issue } from './ledger.js';
import { memoryDb } from '../config/database.js';

// The purchase catalogue — the single source of truth for both the pricing UI
// and what Stripe actually charges. /t26 climbs faster than the dollars
// (100 → 140 /t26 per $), so bigger bundles are better value. Ids are stable and
// safe to send from the client; the amounts never leave the server.
export const BUNDLES = [
  { id: 't26_300', usd: 2.99, t26: 300 },
  { id: 't26_1200', usd: 9.99, t26: 1200 },
  { id: 't26_7000', usd: 49.99, t26: 7000 }
];

export const getBundle = (id) => BUNDLES.find(b => b.id === id) || null;

// Lazily construct the Stripe client from the environment. Returns null when no
// secret key is set, which callers treat as "payments not configured" (503).
let stripeClient;
export const getStripe = () => {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  stripeClient = key ? new Stripe(key) : null;
  return stripeClient;
};

export const paymentsEnabled = () => !!getStripe();

// Frontend base for the return URLs. In prod set APP_URL=https://requirement5.com.
const appBase = () => (process.env.APP_URL || process.env.API_URL || 'http://localhost:5173').replace(/\/$/, '');

// Create a one-time Checkout Session for a bundle. Amounts come from the server
// catalogue; the buyer and bundle ride in metadata so the webhook can credit the
// right account without trusting the browser. Returns the session (use .url).
export const createCheckoutSession = async (user, bundleId) => {
  const stripe = getStripe();
  if (!stripe) throw new PaymentsNotConfigured();
  const bundle = getBundle(bundleId);
  if (!bundle) throw new UnknownBundle(bundleId);

  const base = appBase();
  return stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: user.id,
    // Stripe emails the receipt here; harmless if absent.
    ...(user.email ? { customer_email: user.email } : {}),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(bundle.usd * 100),
        product_data: {
          name: `${bundle.t26.toLocaleString()} /t26`,
          description: 'Slash_T2.6 top-up for requirement5.com'
        }
      }
    }],
    // Echoed back verbatim on the webhook event — the trust anchor for crediting.
    metadata: { userId: user.id, bundleId: bundle.id, t26: String(bundle.t26) },
    success_url: `${base}/account?topup=success`,
    cancel_url: `${base}/account?topup=cancel`
  });
};

// Verify a raw webhook payload against the signing secret and return the event.
// Requires the UNPARSED request body (a Buffer/string) — see the raw-body mount
// in server/index.js. Throws if the signature or secret is bad.
export const constructWebhookEvent = (rawBody, signature) => {
  const stripe = getStripe();
  if (!stripe) throw new PaymentsNotConfigured();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new PaymentsNotConfigured();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
};

// Credit a completed checkout to the buyer's /t26 balance. Idempotent: Stripe
// may deliver the same event more than once, so we no-op if this session was
// already credited. Returns { credited, alreadyProcessed }.
export const fulfillCheckout = (session) => {
  const userId = session?.metadata?.userId || session?.client_reference_id;
  const bundle = getBundle(session?.metadata?.bundleId);
  if (!userId || !bundle) {
    console.warn('Ignoring checkout session with no known user/bundle:', session?.id);
    return { credited: 0, alreadyProcessed: false };
  }
  if (!memoryDb.getUserById(userId)) {
    console.warn('Checkout for unknown user, ignoring:', userId, session?.id);
    return { credited: 0, alreadyProcessed: false };
  }

  const already = memoryDb.getTransactionsByUser(userId)
    .some(t => t.type === 'topup' && t.stripe_session === session.id);
  if (already) return { credited: bundle.t26, alreadyProcessed: true };

  issue(userId, 'topup', bundle.t26, { stripe_session: session.id, usd: bundle.usd });
  return { credited: bundle.t26, alreadyProcessed: false };
};

export class PaymentsNotConfigured extends Error {
  constructor() {
    super('Payments are not configured on this server');
    this.name = 'PaymentsNotConfigured';
  }
}

export class UnknownBundle extends Error {
  constructor(id) {
    super(`Unknown bundle: ${id}`);
    this.name = 'UnknownBundle';
    this.bundleId = id;
  }
}
