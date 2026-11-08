FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl && npm install -g pnpm@11.25.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/monitor/ ./apps/monitor/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @latchwork/shared build && pnpm --filter @latchwork/database build && pnpm --filter @latchwork/monitor build
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 4002 4003
CMD ["node", "apps/monitor/dist/index.js"]
