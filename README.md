# Billme

<img src="logos/FullLogo3.svg" alt="Billme Logo" width="320" />

Eine lokal-first Rechnungs-Desktop-App (Electron + React + SQLite) sowie ein öffentlicher Offer-Portal-Dienst.
Mit Liebe in Deutschland entwickelt.

> ## ⚠️ Fork-Hinweis
>
> **Dies ist ein Fork von [bl4ckh4nd/billme](https://github.com/bl4ckh4nd/billme), gepflegt von [FelixLenz-Code](https://github.com/FelixLenz-Code) zur Fehlerbehebung.**
> Es ist nicht das offizielle Upstream-Repository. Die in diesem Fork vorgenommenen Änderungen sind unten unter [Fork-Änderungen](#fork-änderungen) aufgeführt.

## Fork-Änderungen

Dieser Fork weicht vom Upstream durch die folgenden Korrekturen ab (Desktop-App / Linux-AppImage):

- **Der MwSt-Schieberegler für Produkte wendet `0 %` jetzt korrekt an.** Im Produkt-Bearbeitungsformular (`apps/desktop/components/ArticlesView.tsx`) wurde der Steuersatz mit `Number(formData.taxRate) || 19` gespeichert, sodass die Auswahl **0 %** (relevant für *Kleinunternehmer* nach §19 UStG) stillschweigend auf **19 %** zurückfiel, weil `0` als „falsy" gilt. Jetzt werden `0 %`, `7 %` und `19 %` alle wie gewählt gespeichert.
- **Beispiel-/Seed-Daten tauchen nach einem Neustart nicht mehr auf.** Das Seeding der Mock-/Beispieldaten in `apps/desktop/electron/main.ts` konnte beim Start laufen und geleerte Tabellen wieder befüllen (löschen → Neustart → Daten zurück). Der Dev-only-`isDev`-Guard ist jetzt zusätzlich durch `!app.isPackaged` abgesichert, sodass ein paketierter Build (z. B. das AppImage) niemals Beispieldaten seedet.
- **Live-Vorschau für Summen/MwSt aktualisiert sofort.** Im Dokument-Editor (`apps/desktop/components/InvoiceDocumentEditor.tsx`) bevorzugte die Vorschau einen gespeicherten `taxSnapshot`, der den Summen-/MwSt-Block einfror, bis das Dokument gespeichert und erneut geöffnet wurde. Die Vorschau verwendet jetzt immer den frisch berechneten Steuer-Snapshot, passend zur Formular-Zusammenfassung und zum gespeicherten Stand.
- **Konfigurierbarer Export-Ordner für Dokumente.** Einstellungen → System hat jetzt eine Option *„Speicherort für Dokumente"*, um das Verzeichnis zu wählen, in das exportierte Rechnungs-/Angebots-PDFs (inkl. ZUGFeRD) geschrieben werden. Leer bedeutet den Standard-App-Speicherort (`userData/exports`). Umgesetzt über eine neue `export.outputDir`-Einstellung, eine `dialog:pickDirectory`-IPC-Route und Auflösung in `apps/desktop/electron/pdfExport.ts` / `ipcHandlers.ts`. (Behebt außerdem einen vorbestehenden Bug, bei dem das Versenden eines Dokuments per E-Mail mit PDF-Anhang `userDataPath` falsch übergab.)
- **Die Export-Ordner-Einstellung wird jetzt tatsächlich wirksam.** Der `export.outputDir`-Wert wurde vom Schema des IPC-Vertrags (`appSettingsSchema` in `packages/desktop-contracts`) beim Speichern und Laden stillschweigend verworfen — zod entfernt unbekannte Schlüssel —, sodass der gewählte Ordner keine Wirkung hatte. Das Feld ist jetzt Teil des Schemas und wird bei jedem Export berücksichtigt. Im Zuge dessen verwenden die IPC-Client-Argumenttypen den *Input*-Typ des Schemas (`z.input`), sodass Felder mit Defaults für Aufrufer optional bleiben.
- **Der Leistungszeitraum ist jetzt Monat + Jahr (`Leistungszeitraum`).** Das Leistungsdatum-Feld akzeptiert nur noch Monat/Jahr (`type="month"`), wird auf der Rechnung z. B. als *„Januar 2026"* angezeigt, und die Bezeichnung wurde von *Leistungsdatum* zu *Leistungszeitraum* umbenannt (Editor + Vorlage). Eine Startup-Migration aktualisiert die Bezeichnung in bereits gespeicherten Vorlagen.
- **Rechnungs-/Angebotsvorlagen können gelöscht werden.** In der Vorlagen-Ansicht wurde ein Löschen-Button ergänzt (die Backend-Lösch-Route existierte bereits, hatte aber keine UI). Beim Löschen der aktiven Vorlage wird deren Aktiv-Zuweisung automatisch entfernt.
- **Vorlage beim Erstellen eines Dokuments auswählen.** Der Dokument-Editor hat jetzt einen *„Vorlage"*-Selector, um zu wählen, welche Rechnungs-/Angebotsvorlage verwendet wird; die Wahl steuert sowohl die Live-Vorschau als auch das exportierte PDF.
- **Das Erfassen einer vollständigen Zahlung markiert die Rechnung als bezahlt.** Eine über *Zahlungseingang* erfasste Zahlung, die den Bruttobetrag deckt, setzt den Status jetzt automatisch auf `paid` (und zurück auf `open`, wenn eine Zahlung später reduziert oder gelöscht wird). Zuvor blieb der Status `open`.
- **Backup & Wiederherstellung mit nativer Dateiauswahl.** Die Wiederherstellung hat einen *„Datei wählen"*-Öffnen-Dialog und akzeptiert Backups von beliebigen Orten (validiert über Dateityp und SQLite-Header statt eines festen Ordners); *„Speichern unter…"* lässt dich wählen, wohin ein Backup geschrieben wird (neue `db:backupTo`-Route). Vor dem Überschreiben aktueller Daten durch eine Wiederherstellung wurde eine Bestätigungsabfrage ergänzt.
- **Ansprechpartner des Kunden als getrennter Vor-/Nachname erfasst.** Der Kunden-Editor hat jetzt *Vorname*- und *Nachname*-Felder für den Ansprechpartner (der kombinierte Name wird aus Kompatibilitätsgründen weiterhin gepflegt). Das ermöglicht eine höfliche Anrede in E-Mails über die neuen Platzhalter `{{client.contactLastName}}` (und `{{client.contactFirstName}}`), z. B. *„Sehr geehrter Herr Müller"*. Eine Migration füllt Vor-/Nachname aus bestehenden kombinierten Namen, und E-Mails fallen auf das Aufteilen des kombinierten Namens zurück, wenn die expliziten Felder leer sind.
- **Kundenspezifische Anrede.** Der Kunden-Editor hat ein *Anrede*-Feld (Freitext mit *Herr*/*Frau*-Vorschlägen), das pro Kunde gespeichert und in E-Mails über den Platzhalter `{{client.salutation}}` bereitgestellt wird, z. B. *„Sehr geehrte {{client.salutation}} {{client.contactLastName}},"* → *„Sehr geehrte Frau Müller,"*. Die neue Spalte `salutation` wird per Migration hinzugefügt.
- **Anpassbarer Standard-E-Mail-Text mit Variablen.** Einstellungen → E-Mail erlaubt das Bearbeiten von Standard-Betreff und -Text mithilfe von Platzhaltern wie `{{document.number}}`, `{{document.total}}`, `{{client.name}}`, `{{client.contact}}` (Ansprechpartner des Empfängers) und `{{company.name}}`/`{{company.owner}}`. Die Platzhalter werden beim Öffnen des Versanddialogs aufgelöst.
- **Audit-*Prüfung* zeigt ein sichtbares Ergebnis.** Das Ergebnis der Integritätsprüfung wird jetzt als In-App-Banner dargestellt (gültig / inkonsistent mit der Fehlerliste) statt über einen unzuverlässigen nativen Dialog, inklusive Ladezustand.
- **Responsive Top-Navigation & Dashboard-Layout.** Die obere Navigationsleiste überlappt Logo/Bedienelemente nicht mehr, wenn das Fenster schmal ist (die Seiten sind ohne feste Breite, die Navigation zentriert sich und scrollt bei Bedarf horizontal). Die Beträge unter *„Top Einnahmequellen"* im Dashboard brechen bei langen Werten nicht mehr um und werden nicht mehr abgeschnitten.
- **Schutz gegen nicht-endliche Wiederkehrungs-Summen.** Die Generierung wiederkehrender Rechnungen begrenzt eine nicht-endliche Bruttosumme jetzt auf `0` (`packages/desktop-data/src/recurring.ts`) und behebt damit einen fehlschlagenden Test.
- **„Datei/Ordner öffnen"-Aktionen scheitern sauber.** `shell:openPath`-Aufrufe (z. B. *PDF öffnen*) sind so gekapselt, dass ein Fehler einen Toast anzeigt, statt in ein fatales Fehler-Overlay zu stürzen.
- **Automatisches Offsite-Backup (konfigurierbar in Einstellungen → System).** Eine neue Karte *„Automatisches Backup (Offsite)"* fügt geplante Backups hinzu, die **beim Beenden der App** ausgelöst werden. Es schreibt immer zuerst einen lokalen SQLite-Snapshot (better-sqlite3 `backup()`), beschränkt auf eine konfigurierbare Aufbewahrungsanzahl, und überträgt ihn dann auf ein wählbares **Offsite-Ziel**: einen **lokalen Ordner** (universell – jede externe Synchronisation wie Nextcloud-Client/Syncthing), natives **WebDAV** (Nextcloud/ownCloud/Standard; Passwort im OS-Schlüsselbund) oder **rclone** (S3/Drive/B2 …). Offsite-Fehler blockieren niemals das lokale Backup oder das Beenden der App; die Datei wird beim nächsten Start erneut versucht. Enthält *„Jetzt sichern"*- und *„Verbindung testen"*-Aktionen sowie eine Statuszeile. Neue Engine `apps/desktop/electron/backupRunner.ts`, IPC `backup:runNow`/`backup:testTarget` und ein `backup`-Einstellungsbereich.
- **Audit-Log-JSON-Serialisierung behoben (und *Prüfung* gehärtet).** Der eigene stabile Serializer gab für fehlende Felder das nackte Token `undefined` aus (z. B. `"servicePeriod":undefined`) und erzeugte damit ungültiges JSON in den Before/After-Snapshots des Audits; die Integritätsprüfung stürzte dann bei `JSON.parse` ab. Undefined-/Funktions-/Symbol-Werte werden jetzt weggelassen (Objekte) oder als `null` geschrieben (Arrays), passend zu `JSON.stringify`. `verifyAuditChain` toleriert außerdem veraltete korrupte Zeilen — sie werden gemeldet statt abzubrechen — und der *Prüfen*-Button zeigt das Ergebnis als In-App-Banner.

### Härtung von Sicherheit & Wartung

Ein repo-weiter Security-Review führte zu folgender Härtung (Server-API, Offer-Portal, Desktop, Abhängigkeiten und Deployment). Ein `pnpm audit --prod` ging von **59 Hinweisen (12 hoch)** auf **1 (niedrig)** zurück; die Test-Suiten von Server-API und Offer-Portal bleiben grün, und der Desktop-Production-Build / das AppImage wurden unter Electron 39 erneut verifiziert.

- **`SESSION_SECRET` wird jetzt erzwungen.** Die Server-API (`apps/server-api/src/auth.ts`) fiel zuvor auf ein fest verdrahtetes `billme-dev-session-secret` zurück, wenn die Env-Variable nicht gesetzt war, was jedem das Fälschen von Session-Tokens erlaubte (vollständige Auth-Umgehung). Sie verweigert jetzt den Start bei fehlendem, leerem, Standard- oder zu kurzem (<16 Zeichen) Secret. Die Docker-Compose-Datei (`docker-compose.server-mode.yml`) verlangt ebenfalls `BILLME_SESSION_SECRET` (und `BILLME_POSTGRES_PASSWORD`), statt schwache Defaults auszuliefern.
- **Brute-Force-Schutz an Auth-Endpoints.** `POST /auth/login` und `/auth/bootstrap` sind ratenbegrenzt (10/min pro Client-IP → HTTP 429 mit `Retry-After`) über einen in-process Limiter, was Credential-Stuffing erschwert.
- **Korrekte Auth-Fehlerbehandlung, keine internen Leaks.** Login-Fehler liefern jetzt **401** (statt eines 500, der die interne Fehlermeldung preisgab), Bootstrap-Konflikte liefern **409**, und unerwartete 500er geben `error.message` nicht mehr an den Client zurück. Die Token-Verifikation toleriert fehlerhafte Eingaben (liefert 401 statt abzustürzen).
- **Konstantzeit-Vergleich von Secrets.** Passwort-Hash-Prüfungen (sowohl der In-Memory- als auch der Postgres-Auth-Store) und die Prüfung des Offer-Portal-Publish-API-Keys verwenden `timingSafeEqual` statt `!==` und beseitigen damit einen Timing-Seitenkanal.
- **Basis-Security-Header + CORS-Allowlist.** Die API sendet jetzt `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` und `Cross-Origin-Opener-Policy` bei jeder Antwort, und CORS kann über `BILLME_CORS_ORIGINS` auf eine explizite Liste beschränkt werden (Default: Spiegelung des Origins, da Auth Bearer-Token- und nicht Cookie-basiert ist).
- **Offer-Portal-Veröffentlichung schlägt standardmäßig fehlsicher fehl (fail closed).** Sowohl der Node- (`apps/offer-portal/src/node.ts`) als auch der Cloudflare-Worker-Einstiegspunkt (`worker.ts`) verlangen jetzt den Publish-API-Key, sofern er nicht ausdrücklich deaktiviert ist, sodass ein unkonfiguriertes Deployment nicht mehr anonym befüllt werden kann.
- **`GET /admin/setup` im Offer-Portal ist jetzt authentifiziert.** Die Setup-/Diagnoseseite war öffentlich erreichbar und gab Konfigurations-Status preis (gesetzte `PUBLIC_BASE_URL`, ob ein Publish-Key existiert, Strict-Auth-Status) — nützliche Aufklärung für Angreifer, besonders der `misconfigured`-Zustand. Sie liegt jetzt hinter demselben `x-api-key`-Check wie die Publish-Endpoints (`apps/offer-portal/src/app.ts`); `GET /health` bleibt bewusst offen für Loadbalancer/Monitoring.
- **Content-Security-Policy im Desktop-Renderer.** Der paketierte (`file://`) Renderer erhält jetzt eine strikte CSP (`script-src 'self'`, kein `eval`, `object-src 'none'`, `frame-ancestors 'none'`, …) via `onHeadersReceived` in `apps/desktop/electron/main.ts`. Im Dev-Modus wird sie absichtlich übersprungen, damit der Vite-Dev-Server / HMR weiter funktioniert.
- **Sicherheits-Updates bei Abhängigkeiten.** `electron` 37 → 39.8.x (mehrere Use-after-free-Fixes), `nodemailer` 6 → 9, `drizzle-orm` 0.44 → 0.45.2 (SQL-Injection-Fix), `hono` 4.9 → 4.12.25 und `@hono/node-server` → 1.19.13 (Offer-Portal). Die Root-`pnpm.overrides` pinnen gepatchtes `fast-uri`, `srvx`, `js-yaml` und `uuid` und entfernen das duplizierte `electron@37`. Hinweis: Der Electron-Major-Upgrade bedeutet, dass ein frisches `pnpm install` das Electron-Binary neu lädt; für lokales `pnpm dev` muss das gebündelte `chrome-sandbox` einmalig `root:root` + Modus `4755` sein (das paketierte AppImage ist davon nicht betroffen).
- **`.env`-Dateien sind jetzt git-ignoriert.** `.gitignore` schließt `.env` / `.env.*` aus (behält `*.example`), um das versehentliche Committen von Secrets zu vermeiden; die Beispiel-Env-Datei dokumentiert, wie starke Werte erzeugt werden.

### Deployment

- **Offer-Portal als eigenständiger Docker-Installer.** Das Offer-Portal lässt sich für ein öffentliches, selbst gehostetes Deployment als Single-Container-Docker-Compose-Stack ausliefern — mit dauerhafter SQLite-Speicherung, PDFs auf der Platte (persistiert im benannten Volume `offer-portal-data`), Healthcheck und `restart: unless-stopped`. Neue Dateien: `apps/offer-portal/Dockerfile`, `docker-compose.offer-portal.yml`, `.env.offer-portal.example`. TLS terminiert ein vorgelagerter Reverse-Proxy; der Container ist standardmäßig nur an `127.0.0.1` gebunden. Start mit `pnpm docker:offer-portal` (siehe `docs/offer-portal.md`).

Eine web-gehostete Demo der App gibt es hier: [Demo](https://demo.getbillme.com/).

BITTE BEACHTEN: Dies ist noch eine Beta-Version. Erwarte kleinere Probleme und melde sie bitte, damit sie behoben werden können!

<img src="assets/screenshot_billme.png" alt="Billme Screenshot" width="900" />

## Funktionen

- Visueller Rechnungs-/Angebots-Editor mit Drag-and-drop-Canvas-Blöcken, Ebenen und wiederverwendbaren Vorlagen
- Vereinheitlichtes Rechnungs-/Angebots-Dashboard mit Suche, Status-Filtern, Portal-Synchronisation und Angebot-zu-Rechnung-Umwandlung
- Profile für wiederkehrende Rechnungen (`Abo-Rechnungen`) mit Intervallplanung und manuellem Ausführen
- Workflow zum Abgleich von Banktransaktionen, um Zahlungen zu verknüpfen und den Zahlungsstatus von Rechnungen automatisch zu aktualisieren
- Kundenverwaltung mit mehreren Kontakten/Adressen plus Kennzahlen zu Umsatz und offenen Posten auf Kundenebene
- Auf Deutschland ausgerichtete Einstellungen inklusive Zahlungsbedingungen, Nummerierung und optionalem ZUGFeRD-EN16931-E-Rechnungs-Export
- Anpassbarer Standard-E-Mail-Betreff/-Text mit Dokument- und Kunden-Platzhaltern
- Datenbank-Backup & -Wiederherstellung mit nativer Dateiauswahl
- Automatisches Offsite-Backup beim Beenden der App (lokaler Ordner / WebDAV / rclone), in den Einstellungen konfigurierbar
- Öffentliche Offer-Portal-API zum Veröffentlichen von Angeboten/Rechnungen, für Kundenentscheidungs-Flows und PDF-Zugriffslinks

## GoBD

Billme enthält technische Kontrollen, die GoBD-orientierte Abläufe unterstützen:

- Append-only-Audit-Log auf DB-Ebene (Update/Delete durch SQL-Trigger blockiert)
- Hash-verkettete Audit-Einträge mit eingebauter Integritätsprüfung
- Audit-Export als CSV zur externen Prüfung/Dokumentation
- Verpflichtende Begründungsabfragen in zentralen Änderungs-/Lösch-Flows

Wichtig: GoBD-Konformität ist immer prozess- und einrichtungsabhängig (einschließlich organisatorischer Kontrollen und Verfahrensdokumentation). Billme erhebt keinen Anspruch auf eine offizielle GoBD-Zertifizierung durch Finanzbehörden.

## Workspace

- `apps/desktop`: Electron-Desktop-App
- `apps/demo`: per Cloudflare Worker gehostete Browser-Demo (Desktop-UI + Mock-Services)
- `apps/offer-portal`: Hono-TypeScript-Dienst für veröffentlichte Angebote/Rechnungen
- `apps/server-api`: Fastify-Server-Mode-API
- `apps/server-worker`: Hintergrund-Worker für Server-Mode-Automatisierung
- `apps/web`: Lite-Browser-Shell für den Server-Mode
- `apps/web-pro`: Pro-Browser-Shell für den Server-Mode
- `packages/ui`: Gemeinsame UI-Komponenten und Hilfsfunktionen

## Voraussetzungen

- Node.js 20+
- `pnpm` 10+

## Erste Schritte

```bash
pnpm install
pnpm dev
```

Damit startet die Desktop-App im Entwicklungsmodus.

## Gängige Befehle

```bash
pnpm dev                 # Desktop-App (Electron + Renderer)
pnpm dev:demo            # Demo-App (Cloudflare Worker)
pnpm dev:renderer        # Nur Renderer
pnpm build               # Desktop-Bundles bauen
pnpm build:demo          # Demo-Frontend bauen + Worker-Typecheck
pnpm dist                # Verteilbare Desktop-Pakete bauen
pnpm build:server-api    # Fastify-API bauen
pnpm build:server-cli    # Billme-Server-CLI-Paket bauen
pnpm build:server-worker # Hintergrund-Worker bauen
pnpm build:web           # Lite-Browser-Shell bauen
pnpm build:web-pro       # Pro-Browser-Shell bauen
pnpm docker:server-mode  # Docker-Compose-Stack starten
pnpm docker:server-mode:logs
pnpm docker:server-mode:down
pnpm docker:offer-portal       # Offer-Portal-Container bauen + starten
pnpm docker:offer-portal:logs
pnpm docker:offer-portal:down
pnpm test:e2e:server:install
pnpm test:e2e:server:smoke
pnpm test:e2e:server:full
pnpm -C apps/desktop test
pnpm -C apps/desktop typecheck
pnpm deploy:demo         # Demo auf Cloudflare Workers deployen
pnpm -C apps/offer-portal dev
pnpm -C apps/offer-portal build
```

## Server-CLI-Paket

`packages/server-cli` stellt einen typisierten Server-Mode-HTTP-Client sowie das `billme`-CLI-Binary für Auth, gemeinsames Billing-CRUD, Exporte und die v1-Pro-Katalog-/Vorlagen-Schnittstelle bereit.

Server-Mode-Playwright benötigt Docker- oder Podman-Zugriff plus eine lokale Chromium-Installation. Siehe `docs/server-mode-docker.md` für die Smoke-/Full-Suite-Einstiegspunkte, Runtime-Overrides und CI-Voraussetzungen.

## Dokumentation

- `docs/architecture.md`
- `docs/offer-portal.md`
- `docs/server-mode-docker.md`
- `docs/releasing.md`

## Lizenz

FSL1.1, siehe `LICENSE`.

## Hinweise

- Generierte Build-Ausgaben (`dist/`, `out/`, Logs) nicht committen.
