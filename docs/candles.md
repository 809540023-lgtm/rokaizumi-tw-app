# Candle catalog and back office

Both candle storefronts (`/candles/` for Australia, `/candles-tw/` for Taiwan) sell a set of five handmade designs at one bundle price per market. Designs, names, SKUs, photos, availability and that bundle price are now editable at:

- `/candles/admin/` — product back office (sign in with the existing admin account, the same one used for `/line-shop/admin.html`)

## Data model

Tables are created lazily on first use and seeded once with `INSERT IGNORE`, so a deploy never overwrites edited products.

- `candle_products` — `id`, `name` (English), `name_tw` (Chinese), `sku`, `lit`, `original`, `active`, `sort_order`
- `candle_images` — `id` (SHA-256 of the bytes), `mime`, `bytes`; served from `/api/candles/img/<hash>.<ext>` with immutable caching
- `candle_settings` — `au_price_aud` and `tw_price_twd`

The first run seeds the 20 original designs in the order the Australian storefront already displayed them, with `au_price_aud=99` and `tw_price_twd=1499`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/candles/products` | Public: active products plus current prices (`no-store`) |
| GET | `/api/candles/img/:file` | Public: uploaded photo blob |
| GET | `/api/candles/admin/products` | Admin: every product, including hidden ones, plus prices |
| POST | `/api/candles/admin/products` | Admin: create (`name`, `nameTw`, `sku`, `sortOrder`, `active`) |
| PATCH | `/api/candles/admin/products/:id` | Admin: rename, re-SKU, reorder, show/hide |
| DELETE | `/api/candles/admin/products/:id` | Admin: hard delete |
| POST | `/api/candles/admin/products/:id/image` | Admin: upload a photo as a base64 data URL |
| PUT | `/api/candles/admin/settings` | Admin: set the AUD and TWD bundle prices |

Admin routes reuse `sdk.authenticateRequest` and require `role === "admin"`, so signing in at `/line-shop/login.html` is enough. Photos must be JPEG, PNG, WebP or GIF and at most 3 MB; the file is verified by its magic bytes, not by the declared MIME type. An uploaded photo replaces both the lit-scene image and the original photo for that design, and the storefront stops looking for `images/lit-NN.jpeg`.

## Storefront behaviour

Each storefront keeps its hardcoded design list as a fallback, then calls `/api/candles/products`. When the call succeeds it rebuilds the grid from the database, applies the current bundle price to every price string on the page (including `document.title`), and uses uploaded photos where present. When the call fails, the hardcoded 20 designs and the built-in prices stay on screen, so a database outage does not blank the shop.

`?product=<id>` on either storefront highlights and scrolls to that design; the back office links to it from the product table.

## Orders

`server/candle-orders.ts` refreshes the catalog at the start of each order submission:

- The five selected designs must all be active; inactive designs are rejected.
- The card charge and the bank-transfer amount use the current `candle_settings` price.
- Order notifications, customer confirmations and paid receipts use the current price and the current SKU/name for each design.

If the database is unreachable the module falls back to the original 20 design ids and the original A$99 / NT$1,499 prices, which keeps the order tests and any outage behaviour predictable.

## Australian online checkout (2026-11)

`/candles/` offers Stripe cards, PayPal and the existing Australian bank transfer. `/api/candles/orders/payment-methods` enables online options only when their server configuration exists:

- Stripe: existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (or existing `LINE_SHOP_...` aliases). Verified webhooks continue at `/api/stripe/webhook`.
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and explicit `PAYPAL_ENVIRONMENT=live` or `sandbox`. Use the matching Business REST app. The integration uses server-side Orders v2 create/capture; the browser never receives a secret.
- `PUBLIC_BASE_URL` defaults to `https://rokaizumi-tw.jp` and must be the HTTPS storefront origin.

No credentials are created or changed by deployment. Missing online configuration leaves that option disabled, preserving bank-transfer checkout.

New online orders add a separate `candle_online_payments` row with immutable amount/currency, provider order/session ID, a hashed random order-link token, checkout URL, and verified PayPal capture ID. Existing order records are not overwritten or deleted. New table creation is additive and lazy. Stripe webhooks compare the exact saved amount; legacy Stripe orders retain their previous validation fallback.

PayPal return/cancel and Stripe return links identify the original order. A return query string alone never marks an order paid. Status requires the random order token; Stripe status also reconciles through a verified Stripe server API read. PayPal capture first reads the provider order, captures only `APPROVED` orders, and re-reads after success or uncertain failure. Paid status requires exact order binding, AUD amount and a final completed capture. Background PayPal reconciliation only reads provider orders and never initiates a charge.

Order emails include the payment provider and checkout link. Failed email delivery is queued. Paid emails use the saved amount and go separately to buyer and merchant. An unavailable checkout after order save returns the saved order number, never an instruction to re-order. Cancelling checkout preserves a resume link for that same order. Bank transfers still need manual bank reconciliation; no automatic transfer-paid workflow was added.

### Verification

Run `node --check client/public/candles/app.js`, `tsc --noEmit`, the build, and all `server/candle-*.test.ts` plus Stripe webhook tests. Tests use mocked provider APIs and local fake SMTP, not real payments or external test emails. Do not run migrations/tests against the production database. Before advertising live card/PayPal payments, verify the live credentials and provider webhook/setup, perform sandbox approval/capture checks, and verify a buyer/merchant email pair with an explicitly approved test recipient. Unit tests alone do not verify live payment or inbox delivery.
