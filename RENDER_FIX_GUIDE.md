# Render 資料庫連接修復指南

## 🚨 當前問題
- 首頁 UI 正常加載 ✅
- 但 API 查詢 (categories.list, products.list 等) 返回 500 錯誤 ❌
- 根本原因：`DATABASE_URL` 環境變量未在 Render 上設置

## 🔍 已知的 TiDB Cloud 連接信息
```
Host: gateway02.us-east-1.prod.aws.tidbcloud.com
Port: 4000
User: 3FVGt3RqCkiFaDE.0fde5e63513d
Database: bMn2Gb7rjKtySEiV2r5RyX
Password: [需要在 Render Dashboard 中設置]
```

## ✅ 快速修復步驟 (手動)

### 方式 1: 通過 Render Dashboard (推薦)
1. 登入 https://dashboard.render.com
2. 找到 "rokaizumi-tw" 服務
3. 進入 "Environment" 標籤
4. 添加新的環境變數：
   ```
   DATABASE_URL=mysql://3FVGt3RqCkiFaDE.0fde5e63513d:[PASSWORD]@gateway02.us-east-1.prod.aws.tidbcloud.com:4000/bMn2Gb7rjKtySEiV2r5RyX
   ```
5. 點擊 "Deploy latest commit" 重新部署

### 方式 2: 通過 Render CLI
```bash
# 安裝 Render CLI
curl -fsSL https://render.com/cli/install.sh | sh

# 登入
render login

# 設置環境變數
render env set DATABASE_URL "mysql://3FVGt3RqCkiFaDE.0fde5e63513d:[PASSWORD]@gateway02.us-east-1.prod.aws.tidbcloud.com:4000/bMn2Gb7rjKtySEiV2r5RyX" --service rokaizumi-tw

# 部署
render deploy --service rokaizumi-tw
```

## 📊 驗證修復

```bash
# 檢查分類
curl https://rokaizumi-tw.jp/api/trpc/categories.list

# 檢查產品
curl https://rokaizumi-tw.jp/api/trpc/products.list

# 檢查首頁是否顯示產品卡片
curl https://rokaizumi-tw.jp/ | grep "日本の美しい小商品"
```

## 🔄 恢復舊產品數據

設置 DATABASE_URL 後，運行：

```bash
# 在本地 (有 DATABASE_URL 設置的情況下)
NODE_ENV=production DATABASE_URL="..." node scripts/restore-products.mjs

# 或在 Render Shell 中
node scripts/restore-products.mjs
```

## 📋 已備份的產品資料
- 位置: `client/src/data/old_products_backup.json`
- 數量: 34 項 (17 個獨特產品)
- 分類: 健康監測、護理用品、床邊照護、復健器材

## 🎯 最終目標
1. ✅ 設置 DATABASE_URL 環境變數
2. ⏳ Render 自動重新部署
3. ✅ API 查詢開始工作
4. ✅ 導入 220 項完整的介護用品資料 (由 user 提供)
5. ✅ 首頁顯示所有產品分類和徽章

## 💡 故障排除

如果仍然失敗：
1. 檢查 TiDB Cloud 是否仍在運行
2. 確認 TiDB 密碼是否正確
3. 檢查網路連接 (Render -> TiDB Cloud)
4. 查看 Render 部署日誌中的詳細錯誤信息

## 📞 聯絡
- GitHub Repo: https://github.com/809540023-lgtm/rokaizumi-tw-app
- 問題追蹤: 檢查 Render 服務日誌
