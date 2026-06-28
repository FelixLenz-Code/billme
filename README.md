# Billme

<img src="logos/FullLogo3.svg" alt="Billme logo" width="320" />

A local-first invoicing desktop app (Electron + React + SQLite) and a public offer portal service.
Built with love in Germany.

> ## ⚠️ Fork notice
>
> **This is a fork of [bl4ckh4nd/billme](https://github.com/bl4ckh4nd/billme), maintained by [FelixLenz-Code](https://github.com/FelixLenz-Code) for bugfixing.**
> It is not the official upstream repository. Changes made in this fork are listed in [Fork changes](#fork-changes) below.

## Fork changes

This fork diverges from upstream with the following fixes (desktop app / Linux AppImage):

- **VAT slider for products now applies `0 %` correctly.** In the product edit form (`apps/desktop/components/ArticlesView.tsx`) the tax rate was saved with `Number(formData.taxRate) || 19`, so selecting **0 %** (relevant for *Kleinunternehmer* per §19 UStG) silently fell back to **19 %** because `0` is falsy. Now `0 %`, `7 %` and `19 %` are all saved as chosen.
- **Example/seed data no longer reappears after a restart.** The mock/example data seeding in `apps/desktop/electron/main.ts` could run on startup and refill emptied tables (delete → restart → data back). The dev-only `isDev` guard is now additionally gated behind `!app.isPackaged`, so a packaged build (e.g. the AppImage) never seeds example data.
- **Live preview totals/VAT update immediately.** In the document editor (`apps/desktop/components/InvoiceDocumentEditor.tsx`) the preview preferred a stored `taxSnapshot`, which froze the totals/VAT block until the document was saved and reopened. The preview now always uses the freshly computed tax snapshot, matching the form summary and what gets saved.
- **Configurable export folder for documents.** Settings → System now has a *"Speicherort für Dokumente"* option to choose the directory where exported invoice/offer PDFs (incl. ZUGFeRD) are written. Empty means the default app location (`userData/exports`). Implemented via a new `export.outputDir` setting, a `dialog:pickDirectory` IPC route, and resolution in `apps/desktop/electron/pdfExport.ts` / `ipcHandlers.ts`. (Also fixes a pre-existing bug where sending a document by e-mail with a PDF attachment passed `userDataPath` incorrectly.)

Check out a web-hosted demo of the app here: [Demo](https://demo.getbillme.com/)).

PLEASE NOTE: This is still a Beta-Version. Expect some minor issues and please report them so they can be fixed!

<img src="assets/screenshot_billme.png" alt="Billme screenshot" width="900" />

## Features

- Visual invoice/offer editor with drag-and-drop canvas blocks, layers, and reusable templates
- Unified invoices/offers dashboard with search, status filters, portal sync, and offer-to-invoice conversion
- Recurring invoice profiles (`Abo-Rechnungen`) with interval scheduling and manual run support
- Bank transaction matching workflow to link payments and automatically update invoice payment status
- Client management with multiple contacts/addresses plus client-level revenue and outstanding metrics
- German-focused settings including payment terms, numbering, and optional ZUGFeRD EN16931 e-invoice export
- Public offer portal API for publishing offers/invoices, customer decision flows, and PDF access links

## GoBD

Billme includes technical controls that support GoBD-oriented workflows:

- Append-only audit log at DB level (update/delete blocked by SQL triggers)
- Hash-chained audit entries with built-in integrity verification
- Audit export as CSV for external review/documentation
- Mandatory reason prompts in key change/delete flows

Important: GoBD conformity is always process- and setup-dependent (including organizational controls and Verfahrensdokumentation). Billme does not claim an official GoBD certification by financial authorities.

## Workspace

- `apps/desktop`: Electron desktop app
- `apps/demo`: Cloudflare Worker-hosted browser demo (desktop UI + mock services)
- `apps/offer-portal`: Hono TypeScript service for published offers/invoices
- `apps/server-api`: Fastify server-mode API
- `apps/server-worker`: background worker for server-mode automation
- `apps/web`: Lite browser shell for server mode
- `apps/web-pro`: Pro browser shell for server mode
- `packages/ui`: Shared UI components and utilities

## Prerequisites

- Node.js 20+
- `pnpm` 10+

## Getting Started

```bash
pnpm install
pnpm dev
```

This starts the desktop app in development mode.

## Common Commands

```bash
pnpm dev                 # Desktop app (Electron + renderer)
pnpm dev:demo            # Demo app (Cloudflare Worker)
pnpm dev:renderer        # Renderer only
pnpm build               # Build desktop bundles
pnpm build:demo          # Build demo frontend + typecheck worker
pnpm dist                # Build distributable desktop packages
pnpm build:server-api    # Build the Fastify API
pnpm build:server-cli    # Build the Billme server CLI package
pnpm build:server-worker # Build the background worker
pnpm build:web           # Build the lite browser shell
pnpm build:web-pro       # Build the pro browser shell
pnpm docker:server-mode  # Start the Docker compose stack
pnpm docker:server-mode:logs
pnpm docker:server-mode:down
pnpm test:e2e:server:install
pnpm test:e2e:server:smoke
pnpm test:e2e:server:full
pnpm -C apps/desktop test
pnpm -C apps/desktop typecheck
pnpm deploy:demo         # Deploy demo to Cloudflare Workers
pnpm -C apps/offer-portal dev
pnpm -C apps/offer-portal build
```

## Server CLI package

`packages/server-cli` provides a typed server-mode HTTP client plus the `billme` CLI binary for auth, shared billing CRUD, exports, and the v1 pro catalog/template surface.

Server-mode Playwright needs Docker or Podman access plus a local Chromium install. See `docs/server-mode-docker.md` for the smoke/full suite entrypoints, runtime override, and CI prerequisites.

## Documentation

- `docs/architecture.md`
- `docs/offer-portal.md`
- `docs/server-mode-docker.md`
- `docs/releasing.md`

## License

FSL1.1, see `LICENSE`.

## Notes

- Do not commit generated build output (`dist/`, `out/`, logs).
