FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl && npm install -g pnpm@11.25.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/gateway/ ./apps/gateway/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @latchwork/shared build && pnpm --filter @latchwork/database build && pnpm --filter @latchwork/gateway build
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 4001
CMD ["node", "apps/gateway/dist/index.js"]
