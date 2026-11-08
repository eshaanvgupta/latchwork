FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @latchwork/shared build && pnpm --filter @latchwork/circuit-compiler build && pnpm --filter @latchwork/tapeout-adapter build && pnpm --filter @latchwork/contracts build && pnpm --filter @latchwork/sdk build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:4001
ARG NEXT_PUBLIC_MONITOR_URL=http://localhost:4003
ARG NEXT_PUBLIC_TEST_SERVICE_URL=http://localhost:4002
ARG NEXT_PUBLIC_RPC_URL=https://rpc.xlayer.tech
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL NEXT_PUBLIC_MONITOR_URL=$NEXT_PUBLIC_MONITOR_URL NEXT_PUBLIC_TEST_SERVICE_URL=$NEXT_PUBLIC_TEST_SERVICE_URL NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
RUN pnpm --filter @latchwork/web build
ENV NODE_ENV=production HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["pnpm", "--filter", "@latchwork/web", "start"]
