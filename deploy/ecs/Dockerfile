# Alibaba ECS staging image: preserve the patched wouter dependency.
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN corepack pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
# 啟動時 bootstrapDatabase() 會讀 drizzle/*.sql 建表、讀 data/products-full.json
# 匯入商品（含說明），兩者都必須進 runtime image，否則容器起來只會是空資料庫。
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/data/products-full.json ./data/products-full.json
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
