# OpenClaw API 文檔

## 概述

本 API 允許 OpenClaw 自動化平台通過 API Key 認證，使用管理員權限將商品資訊上傳到ろかいずみ合同会社網站。

**基礎 URL:** `https://your-domain.com/api/openclaw`

---

## 認證

### API Key 認證

所有請求都需要提供有效的 API Key。API Key 可以通過以下方式提供：

**方式 1：HTTP Header**
```
X-API-Key: your-api-key-here
```

**方式 2：Query Parameter**
```
GET /api/openclaw/products?api_key=your-api-key-here
```

### 安全建議

1. **保護 API Key** - 不要在公開的代碼或文檔中洩露 API Key
2. **IP 白名單** - 建議為 API Key 配置 IP 白名單，限制只有特定 IP 可以使用
3. **定期輪換** - 定期更換 API Key 以提高安全性
4. **監控使用情況** - 定期檢查 API 使用日誌，確保沒有異常活動

---

## API 端點

### 1. 上傳商品

**端點:** `POST /api/openclaw/products`

**認證:** 需要有效的 API Key 和管理員權限

**請求體：**
```json
{
  "name": "商品名稱",
  "categoryId": 90001,
  "description": "商品描述",
  "specifications": "規格信息",
  "costJPY": "1000",
  "priceUSD": "10",
  "imageUrl": "https://example.com/image1.jpg",
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    "https://example.com/image3.jpg"
  ]
}
```

**欄位說明：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `name` | string | ✅ | 商品名稱 |
| `categoryId` | number | ✅ | 分類 ID（90001 或 90002） |
| `description` | string | ❌ | 商品描述 |
| `specifications` | string | ❌ | 規格信息 |
| `costJPY` | string | ✅ | 成本價格（日幣） |
| `priceUSD` | string | ✅ | 售價（美元） |
| `imageUrl` | string | ✅ | 第一張圖片 URL（用於列表顯示） |
| `images` | array | ❌ | 所有圖片 URL 陣列（用於詳情頁輪播） |

**分類 ID 參考：**
- `90001` - 銀髮生活品質加乘輔具
- `90002` - 日本精美小商品

**成功回應 (201 Created)：**
```json
{
  "success": true,
  "message": "商品已成功上傳",
  "productId": 12345,
  "data": {
    "name": "商品名稱",
    "categoryId": 90001,
    "costJPY": "1000",
    "priceUSD": "10",
    "profitTWD": "100"
  }
}
```

**錯誤回應：**

**400 Bad Request - 缺少必填欄位**
```json
{
  "error": "Validation Error",
  "message": "缺少必填欄位",
  "details": [
    "商品名稱 (name) 為必填",
    "分類 ID (categoryId) 為必填"
  ]
}
```

**401 Unauthorized - 無效的 API Key**
```json
{
  "error": "Unauthorized",
  "message": "Invalid API Key."
}
```

**403 Forbidden - API Key 已停用或 IP 不在白名單**
```json
{
  "error": "Forbidden",
  "message": "API Key is disabled."
}
```

**404 Not Found - 分類不存在**
```json
{
  "error": "Not Found",
  "message": "分類 ID 90003 不存在"
}
```

**429 Too Many Requests - 超過速率限制**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Maximum 1000 requests per 3600 seconds."
}
```

**500 Internal Server Error - 伺服器錯誤**
```json
{
  "error": "Internal Server Error",
  "message": "處理請求時發生錯誤"
}
```

---

### 2. 獲取 API 使用統計

**端點:** `GET /api/openclaw/stats`

**認證:** 需要有效的 API Key

**成功回應 (200 OK)：**
```json
{
  "apiKeyName": "OpenClaw Integration",
  "isActive": true,
  "requestCount": 156,
  "lastUsedAt": "2026-02-06T12:30:45.123Z",
  "rateLimit": 1000,
  "rateLimitWindow": 3600
}
```

---

## 價格計算邏輯

系統使用以下匯率進行自動轉換：

- **成本（日幣 JPY）** → **售價（美元 USD）** → **利潤（台幣 TWD）**

**匯率（示例）：**
- 1 JPY = 0.2 TWD
- 1 USD = 30 TWD

**計算公式：**
```
成本 (TWD) = costJPY × 0.2
售價 (TWD) = priceUSD × 30
利潤 (TWD) = 售價 (TWD) - 成本 (TWD)
```

**例子：**
- 成本：1000 JPY = 200 TWD
- 售價：10 USD = 300 TWD
- 利潤：300 - 200 = 100 TWD

---

## 使用示例

### cURL 示例

```bash
curl -X POST https://your-domain.com/api/openclaw/products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "name": "日本百元商品 - 毛巾",
    "categoryId": 90002,
    "description": "高質量日本毛巾，柔軟舒適",
    "specifications": "尺寸: 34x76cm, 材質: 100% 棉",
    "costJPY": "500",
    "priceUSD": "5",
    "imageUrl": "https://example.com/towel.jpg",
    "images": [
      "https://example.com/towel1.jpg",
      "https://example.com/towel2.jpg"
    ]
  }'
```

### Python 示例

```python
import requests
import json

api_key = "your-api-key-here"
url = "https://your-domain.com/api/openclaw/products"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": api_key
}

data = {
    "name": "日本百元商品 - 毛巾",
    "categoryId": 90002,
    "description": "高質量日本毛巾，柔軟舒適",
    "specifications": "尺寸: 34x76cm, 材質: 100% 棉",
    "costJPY": "500",
    "priceUSD": "5",
    "imageUrl": "https://example.com/towel.jpg",
    "images": [
        "https://example.com/towel1.jpg",
        "https://example.com/towel2.jpg"
    ]
}

response = requests.post(url, headers=headers, json=data)
print(response.status_code)
print(json.dumps(response.json(), indent=2))
```

### JavaScript 示例

```javascript
const apiKey = "your-api-key-here";
const url = "https://your-domain.com/api/openclaw/products";

const data = {
  name: "日本百元商品 - 毛巾",
  categoryId: 90002,
  description: "高質量日本毛巾，柔軟舒適",
  specifications: "尺寸: 34x76cm, 材質: 100% 棉",
  costJPY: "500",
  priceUSD: "5",
  imageUrl: "https://example.com/towel.jpg",
  images: [
    "https://example.com/towel1.jpg",
    "https://example.com/towel2.jpg"
  ]
};

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": apiKey
  },
  body: JSON.stringify(data)
})
  .then(response => response.json())
  .then(result => console.log(result))
  .catch(error => console.error("Error:", error));
```

---

## 速率限制

- **預設限制:** 1000 請求 / 小時
- **限制超出:** 返回 429 Too Many Requests

---

## API 日誌

所有 API 請求都會被記錄，包括：
- 請求時間
- API Key ID
- 端點和方法
- 請求體和回應體
- 客戶端 IP 地址
- HTTP 狀態碼
- 執行時間

---

## 故障排除

### 問題：401 Unauthorized

**原因：**
- API Key 無效或不存在
- API Key 未在請求中正確提供

**解決方案：**
1. 檢查 API Key 是否正確
2. 確認 API Key 在 X-API-Key header 或 api_key query parameter 中
3. 聯絡管理員重新生成 API Key

### 問題：403 Forbidden

**原因：**
- API Key 已被停用
- 客戶端 IP 不在白名單中

**解決方案：**
1. 檢查 API Key 是否啟用
2. 確認客戶端 IP 在 API Key 的 IP 白名單中
3. 聯絡管理員更新 IP 白名單

### 問題：400 Bad Request

**原因：**
- 缺少必填欄位
- 欄位值格式不正確
- 分類 ID 不存在

**解決方案：**
1. 檢查請求體中的所有必填欄位
2. 確認 categoryId 是有效的（90001 或 90002）
3. 確認 costJPY 和 priceUSD 是有效的數字格式

### 問題：429 Too Many Requests

**原因：**
- 超過了 API 速率限制

**解決方案：**
1. 減少請求頻率
2. 等待限制重置（通常為 1 小時）
3. 聯絡管理員提高速率限制

---

## 支援

如有任何問題或需要協助，請聯絡技術支援團隊。

---

**最後更新:** 2026-02-06
