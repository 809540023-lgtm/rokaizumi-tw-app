#!/usr/bin/env bash
# 推 v4 完整版到 GitHub repo: rokaizumi-tw-app
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
REPO_URL="https://github.com/809540023-lgtm/rokaizumi-tw-app.git"

echo -e "${GREEN}▶ Rokaizumi v4 推送到 ${REPO_URL}${NC}"
cd "$(dirname "$0")"

# 移除 .manus（Manus 工具殘留資料）
rm -rf .manus 2>/dev/null

# 移除可能的舊 .git 殘骸
rm -rf .git

git init -b main
git config user.email "${USER:-deploy}@$(hostname)"
git config user.name "${USER:-rokaizumi}"
git add .
git commit -m "Initial commit: rokaizumi-tw v4 full React app

- New v3 design system applied to all pages
- Home, Products, ProductDetail, Cart, Checkout redesigned
- New pages: About, B2B (with inquiry form), Guides
- 14 new components (SiteHeader, HeroSection, Newsletter, etc.)
- New backend routes: newsletter, b2bInquiries, productReviews
- 3 new database tables
- 6 deployment configs: Vercel, Railway, Render, Docker, VPS
- Build verified: pnpm build passes cleanly
" --quiet

echo -e "${GREEN}▶ 推送到 GitHub (會提示輸入帳號 + Token)${NC}"
echo -e "${YELLOW}  Username: 809540023-lgtm${NC}"
echo -e "${YELLOW}  Password: 您的 GitHub Personal Access Token${NC}"
echo ""

git remote add origin "$REPO_URL"
git push -u origin main

echo ""
echo -e "${GREEN}✓ 推送完成！${NC}"
echo "https://github.com/809540023-lgtm/rokaizumi-tw-app"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo "  1. 開啟 Railway: https://railway.app/new"
echo "  2. Deploy from GitHub repo → 選 rokaizumi-tw-app"
echo "  3. Add MySQL database (Add → Database → MySQL)"
echo "  4. 在 Variables 填入 .env.example 內的設定值"
echo "  5. 自動部署完成後跑：pnpm db:push 然後 node scripts/seed-220-products.mjs"
