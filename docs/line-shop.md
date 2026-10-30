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

## Shop backend login and store registration

`/line-shop/login.html` is the shop's own email + password entry point (register or sign in) and `/line-shop/store.html` is the store registration and profile page. Both use the existing `users` table and the same session cookie as the rest of the site, so an account created here also works elsewhere. Passwords are stored as scrypt `salt:hash` and login/registration attempts are limited per IP for 15 minutes.

A store registration by a normal account starts as `pending` and cannot read orders until an administrator approves it on `/line-shop/admin.html` (已登錄商店 → 核准啟用). A registration made by an administrator is activated immediately, which keeps first-time setup short. Only one store per account is allowed.

The earliest `active` store is the shop's primary store: new orders are tagged with its `store_id`, and when the first store becomes active the previously unassigned orders are attached to it. Store owners see and fulfil only their own orders; administrators see every order and can suspend a store, which immediately blocks its order list.

`/line-shop/admin.html` serves both audiences. It reads `/api/line-shop/auth/me` on load: an administrator gets 商品上架管理, every order and 已登錄商店; an owner of an `active` store gets only their own orders from `/api/line-shop/store/orders`; anyone else is redirected to `store.html`, and a signed-out visitor to `login.html`.

The backend pages share the storefront's `style.css` rather than keeping a second stylesheet: `login.html` and `store.html` set `class="formpage"` on `<body>`, which switches on the form layout (soft background, 900px column, stacked labels, tabs).

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

## Product shelf management

`/line-shop/admin.html` lists every row of `line_shop_products`, including deactivated ones, and lets an administrator change the shelf state, the NT$ price and the available stock. Saves go through `PATCH /api/line-shop/admin/products/:id`, which takes a row lock, rewrites `data_json.price` and updates `stock`/`active` in one transaction, so the storefront (`GET /api/line-shop/products`, which reads the same rows) reflects the change immediately.

Deactivating a product hides it from the storefront without touching existing orders. A cart that still holds it fails checkout with 商品或數量無效，請重新整理 rather than selling it. Prices must be integers in 1–100000 and stock integers in 0–100000; unknown fields are rejected. Products listed in the code-level `excluded` set never enter the table and cannot be re-activated through the UI, so a legal or supply blocklist stays authoritative.

The same page also edits the customer-facing copy: 品名, 說明, 規格, 日文名, 標籤 and the image URL. Those edits are stored in the lazily added `admin_json` column instead of rewriting `data_json`, because `data_json` is only ever populated by `INSERT IGNORE` at boot and would drift from `server/public/line-shop-catalog.json`. `catalog()` merges `admin_json` over the stored product, and `desc` keeps its existing precedence: an edited description wins, otherwise the catalog file wins over the possibly stale database copy. Clearing a field deletes its override, so the catalog file value comes back. Image URLs must start with `https://` or `/`; photos can also be uploaded, see below. Price and stock stay in their own columns so the existing checkout stock accounting is untouched.

### Product images

Product photos live in the repository at `client/public/line-shop/img/<id>.webp` and are served from `/line-shop/img/...` with a one-week `Cache-Control`. They were originally hotlinked to a third party's test site, so one outage there would have blanked the whole shop. `server/public/line-shop-catalog.json` is the source of truth for those paths, and the one-time `2026-10-30-self-hosted-images` migration rewrites `data_json.image` for rows that still hold the old external URL or an inline base64 image; `admin_json` overrides are never touched. `server/line-shop-catalog.test.ts` fails if a catalog image points off-site, uses a `data:` URI, or is missing from disk. Two products (`COSTCO-76872`, `COSTCO-88665`) intentionally have no photo and render the 商品照片準備中 placeholder.

### External image hosts

Most of the catalogue still points at a supplier's own image host (1122 products on `kokubo.co.jp`, 277 on `www.yamadakagaku.co.jp`, 220 on `kaigo.itembox.design`). Self-hosting all of them would add roughly 100MB to the repository, so they stay hotlinked. `imgSrc()` in `client/src/lib/imageSrc.ts` returns those URLs unchanged, so the browser normally talks to the supplier's CDN directly.

`installImageFallback()`, registered once in `client/src/main.tsx`, listens for image `error` events in the capture phase (image errors do not bubble) and retries the same URL through `/api/img?url=…`, then stops propagation so the component does not give up while the retry is in flight. `data-img-fallback` records which original URL was already retried, so each photo gets exactly one rescue attempt and a different photo gets its own. If the proxy also fails the `src` is already relative, the listener ignores it, and the component renders its placeholder.

`server/image-proxy.ts` only forwards `https` requests to an allowlist (`kokubo.co.jp`, `www.kokubo.co.jp`, `www.yamadakagaku.co.jp`, `kaigo.itembox.design`, plus `IMAGE_PROXY_HOSTS`), rejects non-image content types and bodies over 8MB, and caches the response for 30 days. `server/image-src.test.ts` covers the retry, the loop guard and the non-image cases.

### Uploading a photo

The admin page can replace a photo without a deploy. In 商品上架管理, open 編輯內容, pick a file under 或上傳圖片 (`png` / `jpg` / `webp` / `gif`, at most 3MB), then 儲存內容. The dialog previews the chosen file immediately from a `blob:` object URL (the CSP `img-src` already allows `blob:` and `data:`), and revokes it when the selection changes or the dialog closes, so nothing is uploaded until the save. The browser then base64-encodes the file and posts it to `POST /api/line-shop/admin/products/:id/image`; the server sniffs the magic bytes (the declared type is not trusted), stores the bytes in `line_shop_images` under the sha256 of the content, and points `admin_json.image` at `/api/line-shop/img/<sha>.<ext>`. Those responses are immutable and content-addressed, so replacing a photo simply yields a new URL and every cache stays correct. The file never touches the Render filesystem, which is ephemeral.

## One-time unpaid reminder

The existing one-minute server mail timer queues one customer reminder after the original checkout session has been open for 12 hours. Only live pending orders with a recorded original payment email are considered. Stripe is checked both when queuing and immediately before SMTP: the session must still be unpaid, open, unexpired, and match the order, mode, currency and total. The reminder uses the existing checkout URL and its actual expiration in Taiwan time; it never creates another session or extends the 24-hour deadline. Unique `(order_id,kind)` storage and atomic outbox claims prevent duplicate sends across ticks, restarts and instances. Stripe lookup failures before SMTP retry safely; ambiguous SMTP failures require provider review as for other shop emails. Paid/expired reminders are cancelled. The admin mail list labels these as 客戶12小時付款提醒. Tests run on an isolated mocked outbox; deployment may remind currently eligible pending orders.
