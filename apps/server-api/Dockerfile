FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts
RUN pnpm -C apps/server-api build

WORKDIR /app/apps/server-api

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD node --input-type=module -e "const response = await fetch('http://127.0.0.1:3100/health'); if (!response.ok) process.exit(1);"

CMD ["node", "--import", "tsx", "dist/server.js"]
