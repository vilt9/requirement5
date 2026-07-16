import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  BUNDLES,
  paymentsEnabled,
  createCheckoutSession,
  constructWebhookEvent,
  fulfillCheckout,
  PaymentsNotConfigured,
  UnknownBundle
} from '../services/payments.js';

const router = express.Router();

// Public: the top-up catalogue + whether checkout is live on this server. The
// pricing UI renders straight from this so the shown price is the charged price.
router.get('/bundles', (req, res) => {
  res.json({
    success: true,
    data: {
      enabled: paymentsEnabled(),
      bundles: BUNDLES.map(({ id, usd, t26 }) => ({ id, usd, t26 }))
    }
  });
});

// Start a one-time purchase: create a Stripe Checkout Session and hand back its
// hosted URL for the client to redirect to.
router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const session = await createCheckoutSession(req.user, req.body?.bundle);
    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) {
      return res.status(503).json({ success: false, error: 'Checkout is not available right now.' });
    }
    if (error instanceof UnknownBundle) {
      return res.status(400).json({ success: false, error: 'Unknown top-up bundle.' });
    }
    console.error('Checkout error:', error);
    res.status(500).json({ success: false, error: 'Could not start checkout' });
  }
});

// Stripe webhook. Mounted with a raw-body parser in server/index.js (signature
// verification needs the exact bytes), so this handler must NOT be behind the
// JSON parser. Always answer 2xx once the event is understood, so Stripe stops
// retrying; a 4xx/5xx tells Stripe to redeliver.
export const webhookHandler = (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) {
      return res.status(503).send('Payments not configured');
    }
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const result = fulfillCheckout(event.data.object);
      if (result.credited && !result.alreadyProcessed) {
        console.log(`Credited ${result.credited} /t26 for checkout ${event.data.object.id}`);
      }
    }
  } catch (error) {
    // A crediting failure is ours to fix — ask Stripe to retry.
    console.error('Webhook handling failed:', error);
    return res.status(500).send('Handler error');
  }
  res.json({ received: true });
};

export default router;
