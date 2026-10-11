# LINE guest shop on the company server

The independent storefront is `/line-shop/`. Customers select products and enter recipient details without signing in. The server reserves stock once, computes fixed buyer postage and creates a Stripe Checkout session immediately. The browser redirects directly to Stripe; no administrator quote is required. Existing pending sessions retain their original amounts and can be resumed from email.

Prices come from the preserved 197-product published catalog, including earlier exclusions. The minimum product subtotal is NT$2,000. Buyer postage is NT$220 for product subtotals from NT$2,000 through NT$4,999, and free from NT$5,000. Thresholds exclude postage. The storefront, checkout, order notifications and policies state that orders ship from Japan within seven business days after ordering; delivery time is separate. Packed weight still validates the EMS 30 kg maximum and records carrier cost. Estimated product weights shown in the cart do not determine the charged postage. Seeded stock represents selection limits; operators maintain inventory and arrange fulfillment.

## Render environment

Use separate secrets from the company's existing Stripe features:

- `LINE_SHOP_ENABLED=true` (leave unset until validation is complete)
- `LINE_SHOP_MODE=live` (test mode requires test credentials and suppresses email)
- `LINE_SHOP_ORIGIN=https://rokaizumi-tw.jp`
- `LINE_SHOP_STRIPE_SECRET_KEY` — server-only restricted Stripe key with Checkout Sessions write permission
- `LINE_SHOP_STRIPE_WEBHOOK_SECRET` — signing secret for this specific endpoint
- `LINE_SHOP_NOTIFY_EMAIL=rokaizumi@gmail.com`

Reuse existing `DATABASE_URL`, database SSL configuration, administrator auth and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. Never commit secrets or place them in client JavaScript. A restricted key has no payout, bank-account or refund access.

Register `https://rokaizumi-tw.jp/api/line-shop/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`, in the same mode as the key. Only signed events with matching currency, amount, mode, order metadata and reference mark orders paid. Visiting the success page does not mark payment successful. Stripe expiration releases reserved stock once. The same order submission can be retried after a timeout without a second stock deduction or a second session.

Tables are created lazily and populated with INSERT IGNORE, so deployments do not overwrite existing inventory. Customer order URLs use random bearer tokens; do not publish them. Admin endpoints require the existing admin role, and POST requests must originate from the configured company domain.

## Operational checks

1. In Stripe test mode, submit recipient details, follow the returned checkout URL, pay with an official test card, and verify the webhook and admin status. Test-mode emails are intentionally suppressed.
2. Verify customer and merchant notification delivery when enabling live mode. No real charge should be submitted by an agent without the customer's payment action.
3. Redirect the LINE shop entry to the independent storefront only after payment validation. The previous Sites page cannot process financial transactions.

Email is persisted in an outbox with unique order/kind identifiers. `sent` means the SMTP server accepted it, not inbox delivery. `review` or a stale `sending` requires checking the provider before resending, because a timeout may occur after SMTP acceptance. No automatic ambiguous retry is performed. Manage refunds and exceptional cancellations in Stripe with an operator; this version does not automatically reconcile refunds or restore stock for them. A quote stuck in `quoting` retains stock until the operator retries the identical weight and resolves the underlying failure.

## Validation

`vitest run server/line-shop-pricing.test.ts server/line-shop-webhook.test.ts` covers server-authoritative prices, minimum order, quantities, EMS boundaries, payment matching, raw webhook signatures, tampering and mode mismatch. `npm run build` verifies the production frontend and server bundle. Live payment and email delivery still require credential setup and end-to-end verification.
