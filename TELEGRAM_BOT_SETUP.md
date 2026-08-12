# Telegram 商品上傳機器人設置指南

## 概述

本文檔說明如何設置和運行 Telegram 商品上傳機器人。

## 功能特性

- ✅ 分類選擇（日本百元商品 / 老人看護器材）
- ✅ 商品信息填寫（名稱、價格、描述、規格）
- ✅ 圖片上傳到 S3
- ✅ 商品確認和提交
- ✅ 多語言支持（中文、日文、英文）

## 前置要求

1. **Telegram Bot Token**
   - 在 Telegram 中與 @BotFather 對話
   - 執行 `/newbot` 命令創建新機器人
   - 複製生成的 Token

2. **環境變量設置**
   ```bash
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   DATABASE_URL=your_database_url
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   AWS_S3_BUCKET=your_bucket_name
   AWS_REGION=ap-northeast-1
   ```

## 安裝依賴

```bash
pnpm install
```

已安裝的依賴：
- `telegraf` - Telegram Bot 框架
- `axios` - HTTP 請求
- `dotenv` - 環境變量管理

## 啟動機器人

### 開發模式

```bash
pnpm bot
```

### 生產模式

```bash
TELEGRAM_BOT_TOKEN=your_token NODE_ENV=production node dist/telegram-bot.js
```

## 使用流程

### 用戶交互流程

1. **開始** - 用戶發送 `/start` 命令
2. **選擇分類** - 選擇商品分類
   - 日本百元商品
   - 老人看護器材
3. **填寫信息**
   - 商品名稱
   - 價格
   - 描述
   - 規格
4. **上傳圖片** - 上傳一張或多張商品圖片
5. **確認提交** - 確認信息後提交

### API 端點

#### 創建商品
```
POST /api/trpc/admin.createProduct
```

**請求參數：**
```json
{
  "name": "商品名稱",
  "price": 1000,
  "categoryId": 1,
  "description": "商品描述",
  "specifications": "商品規格",
  "images": ["image_url_1", "image_url_2"],
  "stock": 1,
  "status": "available"
}
```

**分類 ID：**
- `1` - 日本百元商品
- `2` - 老人看護器材

## 文件結構

```
server/
├── telegram-bot.ts          # 機器人主邏輯
├── start-telegram-bot.ts    # 機器人啟動文件
└── storage.ts               # S3 存儲集成
```

## 機器人命令

| 命令 | 描述 |
|------|------|
| `/start` | 開始上傳商品 |
| `/help` | 顯示幫助信息 |
| `/cancel` | 取消當前操作 |

## 故障排除

### 問題：機器人無法連接

**解決方案：**
1. 檢查 `TELEGRAM_BOT_TOKEN` 是否正確
2. 確保網絡連接正常
3. 檢查 Telegram API 是否可用

### 問題：圖片上傳失敗

**解決方案：**
1. 檢查 AWS S3 認證信息
2. 確保 S3 bucket 存在且可寫
3. 檢查圖片大小是否超過限制（建議 < 10MB）

### 問題：商品創建失敗

**解決方案：**
1. 檢查數據庫連接
2. 驗證分類 ID 是否正確
3. 檢查必填字段是否完整

## 安全建議

1. **Token 管理**
   - 不要在代碼中硬編碼 Token
   - 使用環境變量存儲敏感信息
   - 定期輪換 Token

2. **權限控制**
   - 限制機器人只能由授權用戶使用
   - 實現用戶驗證機制
   - 記錄所有操作日誌

3. **數據安全**
   - 使用 HTTPS 傳輸
   - 加密敏感數據
   - 定期備份數據庫

## 性能優化

1. **緩存**
   - 緩存分類信息
   - 緩存用戶會話

2. **並發**
   - 支持多用戶同時使用
   - 使用連接池管理數據庫連接

3. **監控**
   - 記錄機器人日誌
   - 監控 API 性能
   - 設置告警機制

## 擴展功能

### 計劃中的功能

- [ ] 商品編輯功能
- [ ] 批量上傳支持
- [ ] 庫存管理
- [ ] 訂單通知
- [ ] 統計報表
- [ ] 用戶權限管理

## 支持

如有問題，請聯繫開發團隊。

---

**最後更新：** 2025-12-26
**版本：** 1.0.0
