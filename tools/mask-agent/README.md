# 面膜照片本機代理

把 **Google 雲端硬碟** 裡的面膜照片送到網站，並自動跑完 AI 辨識 → 法遵檢核 → 中文文案 → 成本定價。

## 為什麼需要這支程式

網站跑在 Render（雲端主機），**讀不到你電腦上的 Google 雲端硬碟**；
而你電腦上的 rclone 已經授權過那個硬碟了。

所以分工是：

```
你的電腦（本機代理）                     Render（網站）
─────────────────────                   ──────────────────────
rclone 讀 Google 雲端
  ↓ 縮圖（sips）
  ↓ 判斷照片角色
POST /api/mask-agent/sync  ──────────▶  AI 辨識（Pixtral）
                                       法遵檢核（台灣化粧品法規）
                                       中文文案
                                       成本與批發／零售價
                                       上架成前台商品
```

## 安裝（一次性）

1. **rclone**（如果還沒裝）
   ```bash
   brew install rclone
   rclone lsd gdrive:        # 確認看得到你的雲端硬碟
   ```

2. **複製設定檔並填入 token**
   ```bash
   cd tools/mask-agent
   cp config.example.json config.json
   # 編輯 config.json，把 agentToken 換成 MASK_AGENT_TOKEN 的值
   ```

   `MASK_AGENT_TOKEN` 在 Render 後台的 Environment 頁面可以查到。

## 使用方式

```bash
# 最基本：把某個雲端資料夾的照片同步進來並跑流程
node mask-agent.mjs --folder "MaskBridge/面膜/2026-09-30" --brand LuLuLun --supplier-jpy 320

# 一個資料夾裡面放很多商品（每個子資料夾是一個商品）
node mask-agent.mjs --folder "MaskBridge/面膜/2026-10" --per-subfolder --supplier-jpy 320

# 先看會做什麼，不要真的上傳
node mask-agent.mjs --folder "MaskBridge/面膜/2026-09-30" --dry-run

# 跑完流程後直接上架（不建議，先人工確認法遵比較安全）
node mask-agent.mjs --folder "..." --supplier-jpy 320 --publish
```

執行完會顯示：

```
✅ 已建立新品項：MSK-LUL-0001
   品名：LuLuLun 滋潤型面膜 5片入
   照片：新增 3 張、略過 0 張（重複）
   流程：vision✓ pricing✓ copy✓ compliance✓
   成本 NT$119.31｜批發 NT$185｜零售 NT$325｜成分 14 項
   法遵：warn（阻擋 0、提醒 2）
   中文標示還缺：manufacture_date、applicant、license_no（到後台「面膜作業」補齊）
   👉 確認文案與法遵後，到「面膜作業」按上架
```

## 常用參數

| 參數 | 說明 |
|---|---|
| `--folder <路徑>` | **必要**。rclone 的雲端路徑，或本機路徑（`/`、`./`、`~` 開頭，方便測試） |
| `--brand <品牌>` | AI 讀不出品牌時一定要給 |
| `--supplier-jpy <數字>` | **強烈建議填**。日圓進貨單價；沒填會用照片上的定價推估，不可靠 |
| `--qty <數字>` | 一次進貨量，影響運費攤提（預設 600） |
| `--moq <數字>` | 起批量（預設 12） |
| `--stock <數字>` | 可上架庫存（預設 30） |
| `--hint <文字>` | 給 AI 的現場補充，例如「難波門市限定，一盒5片入」 |
| `--per-subfolder` | 每個子資料夾當成一個商品 |
| `--publish` | 跑完直接上架 |
| `--dry-run` | 只列出會做什麼，不上傳 |
| `--max-side <px>` | 縮圖的最長邊（預設 1200，越大越清楚也越佔空間） |
| `--keep-temp` | 保留暫存檔案（除錯用） |

## 照片命名建議

代理會從**檔名**猜測照片角色，猜不到就依順序輪（front → back → box → texture → detail）：

| 檔名含 | 角色 |
|---|---|
| `front`、`正面`、`主圖`、`omote` | 正面（會當商品主圖） |
| `back`、`背面`、`成分`、`ingredient`、`label` | 背面成分 |
| `box`、`外盒`、`盒裝` | 外盒 |
| `texture`、`質地`、`精華` | 質地特寫 |
| `detail`、`特寫` | 細節 |

例：`LuLuLun-正面.jpg`、`LuLuLun-背面成分.jpg`

> 💡 **背面成分照最重要**。AI 就是靠它讀出全成分，成分讀不到，中文標示第 4 項就一直是缺的。

## 重複執行是安全的

- 同一個雲端資料夾再跑一次 → 會沿用同一筆品項，**不會重複建檔**
- 同一張照片（同檔名）再上傳一次 → 自動略過
- 所以放心用排程每天跑，例如：

```bash
# 每天 9:00 自動同步（crontab -e）
0 9 * * * cd ~/mask-agent && /opt/homebrew/bin/node mask-agent.mjs --folder "MaskBridge/面膜" --per-subfolder >> sync.log 2>&1
```

## 疑難排解

| 症狀 | 處理 |
|---|---|
| `連不上網站或 token 不對` | 確認 `config.json` 的 `agentToken` 與 Render 的 `MASK_AGENT_TOKEN` 一致 |
| `找不到 rclone` | `brew install rclone`，並用 `rclone lsd gdrive:` 確認授權還在 |
| `AI 已設定：否` | 網站沒設 `MISTRAL_API_KEY`，AI 辨識會失敗 |
| `流程錯誤：沒有進貨價` | 加上 `--supplier-jpy`，或確認照片拍得到價格標 |
| 照片沒縮圖 | 非 macOS 沒有 `sips`，會以原始大小上傳（檔案較大但可用） |
| 品項一直停在「法遵卡關」 | 文案有違規字眼或特定用途缺查驗登記字號，到「面膜作業」看報告 |
