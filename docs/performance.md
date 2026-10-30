# 效能：為什麼這樣設定

改動前先看這份，避免把下面幾件事「順手改回去」。

## 不要加回 `vite-plugin-manus-runtime`

這個 Vite plugin 會在**每一份 HTML** 內嵌 `runtime_dist/manus-runtime.js`（366KB）
當成 inline `<script id="manus-runtime">`。那是給 Manus 預覽主機用的橋接程式，
本站部署在 Render，沒有任何程式會讀 `window.__MANUS_HOST_DEV__`。

留著的話每份 HTML 是 370KB，而且 inline script 沒辦法單獨快取，
每次開頁面都要重新下載、重新解析、重新執行 366KB 的 JS。
拿掉之後 `dist/public/index.html` 是 3.5KB。

（`client/src/_core/hooks/useAuth.ts` 裡的 `"manus-runtime-user-info"` 只是
localStorage 的 key 名稱，跟這支 script 無關，不用動。）

## 靜態檔的 Cache-Control

`server/_core/vite.ts` 的 `staticCacheControl()` 決定：

| 路徑 | Cache-Control | 原因 |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | 檔名帶內容雜湊，內容一變檔名就變 |
| `/line-shop/img/*` | `public, max-age=604800` | 商品圖檔名固定、內容不變 |
| 其他（HTML、`sw.js`、`*.json`） | 預設 `max-age=0` | 每次都要驗證，後台改完才會立刻看到 |

`/assets/` 若維持預設的 `max-age=0`，每開一次頁面瀏覽器都要重新驗證四支 JS，
Cloudflare 也不會放進邊緣快取（`cf-cache-status: DYNAMIC`），全部回 Render 新加坡拿。
**`sw.js` 不能長期快取**，否則 Service Worker 的更新會延後生效。

## `products.list` 不帶 `description`

`server/db.ts` 的 `getAllProducts()` 回傳 `ProductListCard`（少了 `description`）。
資料庫裡 1619 筆商品光是描述就佔整包 JSON 的 82%（4.0MB 裡的 3.3MB），
但首頁、商品列表、分類頁、相關商品都只排卡片，不會顯示描述。
需要描述請走 `products.getById`（商品詳情頁就是用這支）。

改動前後：`/api/trpc/products.list` 4.02MB → 約 0.66MB。

## Service Worker

`client/public/sw.js` 的 `CACHE_VERSION` 換版會清掉舊快取。
HTML 結構大改（例如上面拿掉 inline runtime）時要一起升版，
否則舊快取裡的 `/` 還指著已經被刪掉的 asset 檔名，離線時會開不起來。
