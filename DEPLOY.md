# ろかいずみ rokaizumi-tw v4 . 部署選擇指南

> 不同部署平台對應不同需求。先看「我該選哪個」，再看「怎麼做」。

---

## 部署平台比較表

| 平台 | 月費（起跳） | 含 DB | 自訂網域 | 部署難度 | 自由度 | 適合您嗎？ |
|---|---|---|---|---|---|---|
| **Vercel + PlanetScale** | $0-20 | ✅ | ✅ | ⭐ 最簡單 | 中 | 想最快上線 |
| **Railway** | $5-20 | ✅ 一鍵 MySQL | ✅ | ⭐ 簡單 | 中高 | 一切搞定型 |
| **Render** | $14（app+db） | ✅ 一鍵 MySQL | ✅ | ⭐ 簡單 | 中 | 預算固定 |
| **Fly.io** | $5-15 | 需另外設 | ✅ | ⭐⭐ 中等 | 高 | 全球低延遲 |
| **VPS（DigitalOcean / Linode / Vultr）** | $6-12 | 自己裝 | ✅ | ⭐⭐⭐ 進階 | 最高 | 想完全掌控 |
| **AWS / GCP** | $30+ | RDS / Cloud SQL | ✅ | ⭐⭐⭐⭐ 困難 | 最高 | 大型／企業級 |
| **GitHub Pages** | $0 | ❌ 純靜態 | ✅ | ⭐ 最簡單 | 低 | 只放設計稿 |

---

## 我的推薦（按情境）

### 🥇 立刻要上線、不想花太多時間 → **Railway**
- 5 分鐘從 GitHub 連到上線
- MySQL、Redis 都是一鍵 Add Service
- 自動 HTTPS、自訂網域、預覽分支
- 缺點：流量大會比較貴（每月 $5 起，含 $5 USD usage）

### 🥈 想要最快、最便宜、預期流量會大 → **Vercel + PlanetScale**
- Vercel 免費版額度大，超快 CDN
- PlanetScale 是無伺服器 MySQL，免費 1 GB
- 缺點：Serverless 寫法跟傳統 Express 不太一樣，需要把後端拆成 API routes 或用 Edge Functions

### 🥉 預算固定、不想看 usage based → **Render**
- 月費 $14（$7 app + $7 db），不會超支
- Singapore 機房對台灣延遲低
- 缺點：免費版會冷啟動，付費版才穩定

### 🛠 想完全掌握、有人懂 Linux → **VPS + Docker Compose**
- DigitalOcean / Linode / Vultr 月 $6 開始
- 我準備好 `Dockerfile` + `docker-compose.yml` + Nginx + Let's Encrypt 全自動
- 缺點：要會 ssh、要自己備份、要自己管 server

---

## 各平台具體部署步驟

### A. Railway（最簡單，推薦先試）

1. 開帳號：https://railway.app（用 GitHub 登入）
2. New Project → Deploy from GitHub repo → 選 `rokaizumi-tw-v3`
3. Railway 偵測 `deploy/railway.json` 自動配置
4. Add → Database → MySQL（一鍵）
5. 把 MySQL 自動產生的 `DATABASE_URL` 在 app service 的 Variables 設好
6. 其他環境變數依 `.env.example` 填入
7. 第一次部署完成後，到 app shell 跑：
   ```bash
   pnpm db:push
   node scripts/seed-220-products.mjs
   ```
8. 自訂網域：Settings → Domains → Add `rokaizumi-tw.jp`，依指示設 DNS CNAME

### B. Vercel + PlanetScale

1. **建資料庫**
   - 開 PlanetScale 帳號：https://planetscale.com
   - Create database → `rokaizumi` → Connect → 取得 `DATABASE_URL`

2. **部署到 Vercel**
   - 開 https://vercel.com（用 GitHub 登入）
   - Import → 選 `rokaizumi-tw-v3`
   - Framework Preset 選 **Other**（或 Vite）
   - Build Command: `pnpm build`
   - Output Directory: `dist`
   - Environment Variables：把 `.env.example` 內的全部填進去
   - Deploy

3. **跑 migration**
   - 本機：`DATABASE_URL=... pnpm db:push`
   - 本機：`DATABASE_URL=... node scripts/seed-220-products.mjs`

4. 自訂網域：Vercel project → Settings → Domains → Add

### C. Render

1. 開帳號：https://render.com
2. New → Blueprint → 選 repo → 偵測到 `deploy/render.yaml` 自動建立 app + db
3. 環境變數填好（render.yaml 已標出哪些要手動填）
4. Deploy 完後在 Shell 跑：`pnpm db:push && node scripts/seed-220-products.mjs`
5. 自訂網域：Settings → Custom Domain → Add

### D. VPS + Docker Compose（最自由）

```bash
# 1. ssh 到您的 VPS（例：Ubuntu 22.04）
ssh root@your-vps-ip

# 2. 裝 Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 3. 拉 repo
git clone https://github.com/809540023-lgtm/rokaizumi-tw-v3.git
cd rokaizumi-tw-v3

# 4. 設定 env
cp .env.example .env
nano .env  # 編輯填入所有值

# 5. 啟動
docker compose -f deploy/docker-compose.yml up -d

# 6. 第一次跑 migration
docker compose exec app pnpm db:push
docker compose exec app node scripts/seed-220-products.mjs

# 7. 簽 Let's Encrypt SSL 憑證
docker compose exec certbot certbot certonly --webroot \
  -w /var/www/certbot \
  -d rokaizumi-tw.jp \
  -d www.rokaizumi-tw.jp \
  --email your-email@example.com \
  --agree-tos --no-eff-email
```

DNS 那邊把 A 紀錄指向 VPS IP 即可。

---

## 部署前清單

不論選哪個平台，先確認：

- [ ] **資料庫**：MySQL 8.0+
- [ ] **JWT 密鑰**：`openssl rand -base64 48` 產一個
- [ ] **Stripe 帳號** + 拿到 sk_live、pk_live、webhook secret
- [ ] **S3 / R2 帳號** + 開好 bucket + 拿到 access key
- [ ] **Email 服務**（Resend 推薦，免費 3000 封/月）
- [ ] **網域**：在 DNS 商把 A / CNAME 指好
- [ ] **HTTPS**：上述平台幾乎都自動處理；VPS 用 Certbot

---

## 推薦的最佳組合（依規模）

### 小規模（月訂單 < 1000）
- **Railway** $20/月（app + MySQL + Redis）
- **Cloudflare R2** $0（前 10GB 免費）替代 S3
- **Resend** $0（免費 3000 封）
- **Cloudflare DNS** $0
- 總計：**$20/月**

### 中規模（月訂單 1000-10000）
- **Render** $25/月（app + Pro tier MySQL）
- **Cloudflare R2** $0.015/GB
- **Resend** $20/月（5 萬封）
- **Sentry 錯誤監控** $26/月
- 總計：**$70-100/月**

### 大規模（月訂單 > 10000）
- **Vercel Pro** $20/seat + Bandwidth usage
- **PlanetScale Scaler** $39+/月
- **AWS S3 + CloudFront** $30+/月
- **Resend Pro** $90/月
- **Datadog 監控** $30+/月
- 總計：**$200-500+/月**

---

## 接下來

選好平台後，告訴我哪個，我可以再幫您：

1. 連對應的 MCP（Vercel / Netlify 有）
2. 設定 GitHub Actions 自動部署
3. 配置 DNS、SSL、CDN
4. 監控與備份策略

或您直接告訴我「就用 Railway」之類的，我幫您把 `rokaizumi-tw-v3` repo 的 v4 整合分支推上去並完成部署設定。
