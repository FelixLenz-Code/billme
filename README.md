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
- **Export folder setting now actually takes effect.** The `export.outputDir` value was silently dropped by the IPC contract schema (`appSettingsSchema` in `packages/desktop-contracts`) on save and load — zod strips unknown keys — so the chosen folder had no effect. The field is now part of the schema and is honored on every export. As part of this, IPC client argument types use the schema *input* type (`z.input`) so fields with defaults stay optional for callers.
- **Service period is now a month + year (`Leistungszeitraum`).** The service-date field accepts only month/year (`type="month"`), is shown on the invoice as e.g. *"Januar 2026"*, and the label was renamed from *Leistungsdatum* to *Leistungszeitraum* (editor + template). A startup migration updates the label in already-saved templates.
- **Invoice/offer templates can be deleted.** A delete button was added to the Templates view (the backend delete route already existed but had no UI). Deleting the active template clears its active assignment automatically.
- **Pick a template when creating a document.** The document editor now has a *"Vorlage"* selector to choose which invoice/offer template to use; the choice drives both the live preview and the exported PDF.
- **Recording a full payment marks the invoice as paid.** Entering a payment via *Zahlungseingang* that covers the gross total now sets the status to `paid` automatically (and reverts to `open` if a payment is later reduced or deleted). Previously the status stayed `open`.
- **Backup & restore with native file selection.** Restore has a *"Datei wählen"* open dialog and accepts backups from any location (validated by file type and SQLite header instead of a fixed folder); *"Speichern unter…"* lets you choose where to write a backup (new `db:backupTo` route). A confirmation prompt was added before a restore overwrites current data.
- **Customizable default e-mail text with variables.** Settings → E-Mail lets you edit the default subject and body using placeholders such as `{{document.number}}`, `{{document.total}}`, `{{client.name}}`, `{{client.contact}}` (recipient contact person), and `{{company.name}}`/`{{company.owner}}`. Placeholders are resolved when the send dialog opens.
- **Audit *Verify* shows a visible result.** The integrity-check outcome is now rendered as an in-app banner (valid / inconsistent with the list of errors) instead of an unreliable native dialog, including a loading state.
- **Responsive top navigation & dashboard layout.** The top navbar no longer overlaps the logo/controls when the window is narrow (sides are fixed-width-free, the nav centers and scrolls horizontally when needed). The dashboard *"Top Einnahmequellen"* amounts no longer wrap or clip on long values.
- **Guard against non-finite recurring totals.** Recurring invoice generation now clamps a non-finite gross total to `0` (`packages/desktop-data/src/recurring.ts`), fixing a failing test.
- **"Open file/folder" actions fail gracefully.** `shell:openPath` calls (e.g. *PDF öffnen*) are wrapped so a failure shows a toast instead of crashing into a fatal error overlay.

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
- Customizable default e-mail subject/body with document and client placeholders
- Database backup & restore with native file selection
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
