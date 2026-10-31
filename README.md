# jp-arb — 日本→台灣 價差選品掃描器

自動比較「日本二手/新品價」與「台灣市價」，算出扣掉蝦皮所有費用後的淨利與淨利率，
並依淨利率排序，直接產出可上架的候選清單。

## 需求

- Python 3.10+（只用標準庫，免安裝套件）
- Node.js + `npx`（用來呼叫 firecrawl-cli）
- Firecrawl 已登入：`npx -y firecrawl-cli@latest view-config`

## 用法

```bash
cd ~/jp-arb

python3 arb.py rate                                  # 目前匯率
python3 arb.py scan "SONY WH-1000XM5"                # 掃單一商品
python3 arb.py scan "Jabra Speak2 40" --tw "jabra speak2 40" --json
python3 arb.py batch watchlist.txt                   # 批次掃描 → report.md / report.csv
python3 arb.py listing "Jabra Speak2 40" --price 4590   # 產生蝦皮上架草稿
python3 arb.py watch                                 # 自動追蹤目標價（預設讀 watch.txt）
python3 arb.py watch --src yahoo                     # 只比 Yahoo（快，約 1/2 時間）
```

## 自動追蹤（watch）

`watch.txt` 格式：

```
日本關鍵字 | 目標價（円，含運）
Jabra Speak2 55 | 13000
```

來源：**Yahoo（拍賣＋PayPay フリマ）＋ Mercari** 兩邊一起比，取最低。
`--src yahoo` 或 `--src mercari` 可只跑單邊（比較快）。

規則：

- 找到的最低價 **≤ 目標價** → 🎯 通知
- 比上次紀錄 **更低** → 📉 通知
- 原本在售的商品消失 → ⚠️ 已售出／下架 通知
- 通知走 macOS 通知中心（`--no-notify` 可關）
- 每次結果附加到 `watch.log`；狀態存在 `~/.cache/jp-arb/watch-state.json`
  （只會針對「變化」通知，不會每天重複轟炸）

排程（已安裝，每日 09:00 / 21:00）：

```bash
launchctl list | grep jparb                    # 確認在跑
launchctl kickstart -k gui/$(id -u)/com.linemily.jparb.watch   # 立刻手動跑一次
launchctl unload ~/Library/LaunchAgents/com.linemily.jparb.watch.plist  # 停用
```

plist 位置：`~/Library/LaunchAgents/com.linemily.jparb.watch.plist`
（要改時間就編輯裡面的 `StartCalendarInterval`，改完 `unload` 再 `load`）

## watchlist.txt 格式

```
日本關鍵字 | 台灣關鍵字        # 井號後面是註解
SONY WH-1000XM5 | sony wh-1000xm5
```

台灣關鍵字留空就用日本關鍵字去搜。

## 費用模型（`arb.py` 最上方 FEES）

| 項目 | 預設 | 說明 |
|---|---|---|
| deal_fee | 5.5% | 成交手續費，依品類不同，請依賣家中心公告調整 |
| payment_fee | 2.5% | 金流與系統處理費 |
| free_ship_fee | 6% | 免運方案一；若用方案二請設 0 並自行加固定費 |
| tw_shipping | 60 | 店到店運費 |
| packing | 30 | 包材 |
| target_margin | 35% | 目標淨利率（僅供參考，未強制） |

## 選品鐵則

1. **淨利率 < 30% 不要做**，退貨一次就吃掉兩件利潤。
2. 程式已自動過濾「¥1 起標、ジャンク、現状品、通電のみ、部品、カバー、互換品」等垃圾件，
   並要求品況為 全新／未使用近／傷不明顯，價格不得低於成交均價 30%。
3. **藍牙／WiFi 商品在台灣販售需 NCC 審驗合格標籤，家電需 BSMI。**
   自用沒問題，上架販售有法律風險，請自行評估（使用者指定以藍牙品類為主）。
4. 單一品項先試賣 1 件，跑通流程再放量。

## 現成清單

| 檔案 | 內容 |
|---|---|
| `watchlist-bt.txt` | 藍牙會議揚聲器＋藍牙耳機／喇叭（**目前使用中**）|
| `watchlist-safe.txt` | 無射頻品類（鏡頭、有線耳機、釣具等），零法規風險 |
| `watchlist.txt` | 綜合版熱門電子 |

## 資料來源

- 日本：Yahoo!オークション / PayPayフリマ（透過 Firecrawl Alexandria）
- 台灣：飛比價格 feebee.com.tw（彙整蝦皮、momo、PChome）
- 匯率：open.er-api.com（快取 12 小時，存於 `~/.cache/jp-arb/rates.json`）

價格為掃描當下快照，下單前務必點連結複查。

---

## 雲端版（Render）

線上部屬：`https://jp-arb.onrender.com`（自訂網域 `2th.rokaizumi-tw.jp` 待 DNS 生效）

- 程式在 `rokaizumi-tw-app` 的 **`jp-arb` 分支**（獨立分支，`main` 主站不受影響）
- 服務 ID：`srv-dbik14142hec73an767g`，方案 Starter，1GB 持久磁碟掛在 `/data`
- 背景排程每 6 小時掃一次，結果寫入 SQLite，網頁可即時查看
- 網頁有 HTTP Basic 驗證（帳密見 `.deploy-notes.txt`）

環境變數（Render Dashboard → jp-arb → Environment）：

| 變數 | 說明 |
|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl API key（伺服器走 REST，不需要 Node） |
| `TELEGRAM_BOT_TOKEN` | 選填，填了才會推 Telegram |
| `TELEGRAM_ADMIN_IDS` | 選填，逗號分隔 chat id |
| `APP_PASSWORD` | 網頁登入密碼 |
| `SCAN_INTERVAL_HOURS` | 預設 6 |

手動重新部署：

```bash
render deploys create srv-dbik14142hec73an767g --confirm --wait
```
