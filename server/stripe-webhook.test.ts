import { beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const markOrderPaidByStripeSessionId = vi.fn();

vi.mock('./db', () => ({ markOrderPaidByStripeSessionId }));

const { handleStripeWebhook } = await import('./stripe-webhook');

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('Stripe webhook', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_webhook';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook';
    markOrderPaidByStripeSessionId.mockReset();
  });

  it('marks a paid checkout session as paid after signature verification', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_checkout',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_paid',
          object: 'checkout.session',
          payment_status: 'paid',
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });
    const res = response();

    await handleStripeWebhook(
      { body: Buffer.from(payload), header: vi.fn().mockReturnValue(signature) } as never,
      res as never
    );

    expect(markOrderPaidByStripeSessionId).toHaveBeenCalledWith('cs_test_paid');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('rejects an invalid webhook signature without changing an order', async () => {
    const res = response();

    await handleStripeWebhook(
      { body: Buffer.from('{}'), header: vi.fn().mockReturnValue('invalid') } as never,
      res as never
    );

    expect(markOrderPaidByStripeSessionId).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
