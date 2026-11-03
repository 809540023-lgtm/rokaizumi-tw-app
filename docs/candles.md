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
