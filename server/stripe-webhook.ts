import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { markOrderPaidByStripeSessionId } from './db';

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !stripeWebhookSecret) {
    console.error('Stripe webhook received without Stripe configuration');
    res.status(503).json({ error: 'Stripe webhook is not configured' });
    return;
  }

  const signature = req.header('stripe-signature');
  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecretKey);
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', (error as Error).message);
    res.status(400).json({ error: 'Invalid Stripe signature' });
    return;
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        await markOrderPaidByStripeSessionId(session.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', (error as Error).message);
    res.status(500).json({ error: 'Unable to process Stripe webhook' });
  }
}
