FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# better-sqlite3 is a native module; Alpine (musl) has no prebuilt binary, so it
# is compiled from source. The toolchain (python3/make/g++) and libstdc++ stay in
# the image because the compiled .node addon links against libstdc++ at runtime.
RUN apk add --no-cache python3 make g++ libstdc++

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

# Install without lifecycle scripts first (fast, deterministic), then compile the
# single native dependency we actually need for STORAGE_MODE=sqlite.
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts
RUN pnpm -C apps/offer-portal rebuild better-sqlite3
RUN pnpm -C apps/offer-portal build

WORKDIR /app/apps/offer-portal

# Bind to all interfaces so the published container port is reachable (node.ts
# otherwise defaults HOST to 127.0.0.1, which only the in-container healthcheck
# can reach). Persisted at runtime via a named volume (see compose file).
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_PATH=/data/offer-portal.sqlite
ENV STORAGE_DIR=/data/storage

EXPOSE 3001

# tsx is used as a loader because tsconfig uses moduleResolution "Bundler", so the
# emitted JS keeps extensionless relative imports that plain `node` cannot resolve.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
  CMD node --input-type=module -e "const r = await fetch('http://127.0.0.1:3001/health'); if (!r.ok) process.exit(1);"

CMD ["node", "--import", "tsx", "dist/node.js"]
