# Telegram 上架機器人

用 Telegram 傳一傳就把商品上到 LINE 商店（`/line-shop/`），不用開電腦登入後台。
機器人跟網站是同一個服務，部署好就一直在線，不需要另外開程式。

## 一、跟 @BotFather 建一個機器人

1. 手機或電腦打開 Telegram，搜尋 **@BotFather**（有藍色勾勾那個）。
2. 傳 `/newbot`。
3. 問你要 **名字**：隨便取，這是別人看到的名稱，例如 `洛海泉上架`。
4. 問你要 **帳號**：只能用英文和底線，而且一定要 `bot` 結尾，例如
   `rokaizumi_shop_bot`。如果被用過就換一個。
5. 建好後它會回一段：

   ```
   Use this token to access the HTTP API:
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

   那串 `數字:英數字` 就是 **TELEGRAM_BOT_TOKEN**，只給你看，不要貼給別人。

## 二、設定兩個環境變數

到 Render → `rokaizumi-tw` 服務 → **Environment** → Add Environment Variable：

| Key | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | 上面那串 token |
| `TELEGRAM_ADMIN_IDS` | 你的 Telegram 數字 ID（下面教你拿） |

存檔後按 **Save**，Render 會自動重新部署（約 2 分鐘）。

### 怎麼知道自己的 Telegram ID

兩種方式都可以：

- 部署後先在 Telegram 對你的機器人傳 `/id`，它會直接回你的 ID。
- 或先不填 `TELEGRAM_ADMIN_IDS` 就部署，傳 `/start` 給機器人，它會回
  「還沒設定誰可以用」並把 ID 印出來，把那個號碼填進環境變數再部署一次。

> `TELEGRAM_ADMIN_IDS` 是**白名單**。沒填的話機器人只會回覆訊息，不會寫入任何商品；
> 填了之後只有名單裡的帳號能上架。多個人要用就寫 `11111111,22222222`。

## 三、上架流程

1. 對機器人傳 `/start`。
2. 選分區：**日本選品 / 日本超市 / 好市多 / 獨家 / AI PC 周邊**
   （這五個就是商店首頁的五個頁籤，選錯分類商品不會出現在前台。）
3. 依序輸入：**商品名稱 → 售價（台幣整數）→ 庫存件數 → 一句話說明**。
4. 傳 **一張商品照片**（或輸入「跳過」）。
5. 檢查摘要，按 **✅ 確認上架**。

上架成功後會回商品編號（`TG-` 開頭），商品立刻出現在
<https://rokaizumi-tw.jp/line-shop/>，也能在
<https://rokaizumi-tw.jp/line-shop/admin.html> 再改價格、庫存、上下架。

其他指令：

| 指令 | 作用 |
| --- | --- |
| `/start` | 上架新商品 |
| `/cancel` | 取消目前這筆 |
| `/id` | 顯示自己的 Telegram ID |
| `/help` | 使用說明 |

## 四、運作方式

- 圖片下載後存進資料庫的 `line_shop_images`，檔名是內容雜湊，由
  `/api/line-shop/img/<hash>.<ext>` 提供。Render 的檔案系統重開就清空，
  所以不存檔案。
- 驗圖規則（JPG / PNG / WebP / GIF、3MB 上限、檔頭比對）跟後台上傳共用
  `shopImage()`，兩邊不會出現只有一邊擋得住的情況。
- 商品寫進 `line_shop_products`，`catalog` 只能是那五個分區之一，其餘欄位
  （規格、日文名、標籤）留空字串，前台缺資料時整行不顯示。
- 沒傳照片就留空，前台顯示「商品照片準備中」。
- 對話狀態存在記憶體裡，服務重啟後要重新 `/start`。

## 五、常見問題

| 症狀 | 原因 |
| --- | --- |
| 傳訊息都沒反應 | Render 沒設 `TELEGRAM_BOT_TOKEN`，或部署失敗。看 Render 的 Logs 有沒有 `Telegram 上架機器人未啟動`。 |
| 回「這個機器人只給店主使用」 | 你的 ID 不在 `TELEGRAM_ADMIN_IDS` 裡。用 `/id` 查，補進環境變數。 |
| 上架成功但前台沒看到 | 選錯分區（前台只有五個頁籤），或庫存是 0（顯示無現貨）。 |
| 圖片一直失敗 | Telegram 圖太大或下載逾時，換一張再傳。 |
| 出現 409 Conflict | 同一個 token 有另一個程式在跑，關掉其中一邊。 |
