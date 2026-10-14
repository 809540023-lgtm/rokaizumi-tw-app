# LINE guest shop on the company server

The independent storefront is `/line-shop/`. Customers select products and enter recipient details without signing in. The server reserves stock once, computes fixed buyer postage and creates a Stripe Checkout session immediately. The browser redirects directly to Stripe; no administrator quote is required. Existing pending sessions retain their original amounts and can be resumed from email.

Prices come from the preserved 197-product published catalog, including earlier exclusions. The minimum product subtotal is NT$2,000. Buyer postage is NT$220 for product subtotals from NT$2,000 through NT$4,999, and free from NT$5,000. Thresholds exclude postage. The storefront, checkout, order notifications and policies state that orders ship from Japan within seven business days after ordering; delivery time is separate. Packed weight still validates the EMS 30 kg maximum and records carrier cost. Estimated product weights shown in the cart do not determine the charged postage. Operators maintain inventory and arrange fulfillment.

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

The one-time `2026-10-14-stock-10` migration sets every active listing's stock to 10. Later checkouts continue to decrement stock, and expired reservations restore it. Seed catalog entries also start at 10 for newly inserted products.

## Operational checks

1. In Stripe test mode, submit recipient details, follow the returned checkout URL, pay with an official test card, and verify the webhook and admin status. Test-mode emails are intentionally suppressed.
2. Verify customer and merchant notification delivery when enabling live mode. No real charge should be submitted by an agent without the customer's payment action.
3. Redirect the LINE shop entry to the independent storefront only after payment validation. The previous Sites page cannot process financial transactions.

Email is persisted in an outbox with unique order/kind identifiers. `sent` means the SMTP server accepted it, not inbox delivery. `review` or a stale `sending` requires checking the provider before resending, because a timeout may occur after SMTP acceptance. No automatic ambiguous retry is performed. Manage refunds and exceptional cancellations in Stripe with an operator; this version does not automatically reconcile refunds or restore stock for them. A quote stuck in `quoting` retains stock until the operator retries the identical weight and resolves the underlying failure.

## Validation

`vitest run server/line-shop-pricing.test.ts server/line-shop-webhook.test.ts` covers server-authoritative prices, minimum order, quantities, EMS boundaries, payment matching, raw webhook signatures, tampering and mode mismatch. `npm run build` verifies the production frontend and server bundle. Live payment and email delivery still require credential setup and end-to-end verification.

## Paid notifications and fulfillment

After a verified Stripe payment, the existing transactional outbox sends the company an `已付款・待備貨` email (configured `LINE_SHOP_NOTIFY_EMAIL`, default `rokaizumi@gmail.com`), with items, amount, recipient details and a link to `/line-shop/admin.html`. Duplicate payment events retain the unique order/kind notification key.

In the administrator page, paid orders start at 待備貨. Select 開始備貨, then 標記已出貨 after handing the parcel to the carrier. Optional tracking numbers can be recorded or corrected. Shipping time is retained on repeat saves. Payment and fulfillment are separate records, so later Stripe event retries cannot reset shipment progress. Unpaid orders cannot be fulfilled; shipped orders cannot return to preparation. All writes require the existing administrator role and configured company origin. Fulfillment is stored in a lazily created table without rewriting existing orders.

## One-time unpaid reminder

The existing one-minute server mail timer queues one customer reminder after the original checkout session has been open for 12 hours. Only live pending orders with a recorded original payment email are considered. Stripe is checked both when queuing and immediately before SMTP: the session must still be unpaid, open, unexpired, and match the order, mode, currency and total. The reminder uses the existing checkout URL and its actual expiration in Taiwan time; it never creates another session or extends the 24-hour deadline. Unique `(order_id,kind)` storage and atomic outbox claims prevent duplicate sends across ticks, restarts and instances. Stripe lookup failures before SMTP retry safely; ambiguous SMTP failures require provider review as for other shop emails. Paid/expired reminders are cancelled. The admin mail list labels these as 客戶12小時付款提醒. Tests run on an isolated mocked outbox; deployment may remind currently eligible pending orders.
