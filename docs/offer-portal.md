# Offer Portal

`apps/offer-portal` is a public-facing service for sharing published offers/invoices and collecting customer decisions.

The desktop app stays the source of truth and publishes document snapshots to the portal.

## Runtime Targets

- Node (self-hosted): `apps/offer-portal/src/node.ts`
- Cloudflare Workers: `apps/offer-portal/src/worker.ts`

## Local Development (Node)

```bash
pnpm install
pnpm -C apps/offer-portal dev
```

Build/start:

```bash
pnpm -C apps/offer-portal build
pnpm -C apps/offer-portal start
```

Environment variables:

- `HOST` (default `127.0.0.1`)
- `PORT` (default `3001`)
- `PUBLIC_BASE_URL` (optional, used for generated links)
- `PUBLISH_API_KEY` (optional, protects publish endpoints with `x-api-key`)
- `REQUIRE_PUBLISH_API_KEY` (optional, default `true` in `NODE_ENV=production`; when enabled and no key is set, publish endpoints return `503 publish_api_key_required`)
- `DATABASE_PATH` (default `./data/offer-portal.sqlite`)
- `STORAGE_DIR` (default `./storage`)
- `STORAGE_MODE` (`memory` or `sqlite`, default `memory`)

If `STORAGE_MODE=sqlite` fails due native module mismatch (`NODE_MODULE_VERSION`), rebuild for Node:

```bash
pnpm -C apps/offer-portal rebuild better-sqlite3
```

## Self-Hosted Docker Deployment

For a public, self-hosted deployment behind your own reverse proxy, the portal
ships as a single-container Docker Compose stack. It uses durable SQLite storage
with PDFs on disk, persisted in a named volume.

Files:

- `apps/offer-portal/Dockerfile`
- `docker-compose.offer-portal.yml`
- `.env.offer-portal.example`

Configure and start:

```bash
cp .env.offer-portal.example .env.offer-portal
# edit .env.offer-portal: set OFFER_PORTAL_PUBLISH_API_KEY (openssl rand -base64 32)
# and OFFER_PORTAL_PUBLIC_BASE_URL to your public domain.
pnpm docker:offer-portal
```

Operations:

```bash
pnpm docker:offer-portal:logs   # follow logs
pnpm docker:offer-portal:down   # stop the stack
```

The container listens on `:3001` and is published to `127.0.0.1:${OFFER_PORTAL_PORT}`
by default. Terminate TLS in your reverse proxy (nginx/Caddy/Traefik) and forward
to that port. Set `OFFER_PORTAL_BIND_HOST=0.0.0.0` only if the proxy runs on a
different, firewalled host — the published port serves plaintext HTTP.

Persistence: SQLite database and PDFs live in the named volume `offer-portal-data`
(mounted at `/data`). Inspect or back it up with `docker volume inspect offer-portal-data`.

Updating: `pnpm docker:offer-portal` rebuilds and restarts in place; the volume survives.

## Cloudflare Workers

Config file: `apps/offer-portal/wrangler.toml`

Recommended bindings:

- `DB` (D1)
- `PDF_BUCKET` (R2)

Deploy:

```bash
pnpm -C apps/offer-portal deploy:cf
```

Without `DB`/`PDF_BUCKET`, the worker falls back to in-memory storage.

## Key Endpoints

- `GET /health`
- `GET /admin/setup`
- `POST /offers`
- `GET /offers/:token`
- `GET /offers/:token/pdf`
- `POST /offers/:token/decision`
- `GET /offers/:token/status`
- `POST /invoices`
- `GET /invoices/:token`
- `GET /invoices/:token/pdf`
- `GET /invoices/:token/status`
- `POST /customers/access-links`
- `POST /customers/access-links/rotate`
- `GET /customers/:token/documents`

## Desktop Integration

- Desktop publishes snapshots (and optional PDFs) through portal API endpoints.
- Customer decisions are synced back and persisted locally in the desktop app.
