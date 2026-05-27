# ろかいずみ rokaizumi-tw v4 . 完整 React 應用

> 日本介護用品專賣 . 大阪直送台灣

完整 v4 整合包，含後台、購物車、結帳、Newsletter、B2B 詢價、商品評論。

## 技術棧

- React 19 + TypeScript + Vite + Tailwind CSS v4
- tRPC 11 + Drizzle ORM + MySQL 8
- Express + JWT auth + Stripe payment

## 部署

請看 DEPLOY.md。推薦 Railway （最簡單）或 Render （預算固定）。

## 本機開發

```bash
pnpm install
cp .env.example .env
pnpm db:push
node scripts/seed-220-products.mjs
pnpm dev
```

打開 http://localhost:5173

## 公司

ろかいずみ合同会社 - 532-0011 大阪市淀川区西中島六丁目10番1の502
