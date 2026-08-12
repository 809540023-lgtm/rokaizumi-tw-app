# --- 階段 1：依賴安裝 ---
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- 階段 2：建置前後端 ---
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- 階段 3：最終正式映像（小）---
FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && apk add --no-cache tini

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/drizzle ./drizzle
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

# 用 tini 處理 zombie process，常見 Node.js 容器最佳實務
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
