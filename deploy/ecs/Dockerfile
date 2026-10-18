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
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
