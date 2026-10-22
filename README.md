# InternshipHQ

A personal, local internship application tracker built with Next.js, TypeScript, Tailwind CSS, Prisma, and SQLite. It starts empty. No account, hosted service, Gmail access, or API key is required.

## Open the desktop app on this Mac

Double-click **InternshipHQ** on your Desktop, or open **InternshipHQ.app** from your personal `~/Applications` folder. The app starts its local server automatically and opens the tracker in its own macOS window. No Terminal command is needed for everyday use.

- **⌘N:** add an application from any screen.
- **⌘I:** open Import & export, with native file selection and save dialogs.
- **⌘R:** reload the workspace.
- **⌘Q**, or close the window: quit and stop the app's server.
- **Help → Open User Guide / Show Startup Log:** documentation and startup troubleshooting.

It uses the same SQLite database as the browser workspace (`prisma/internshiphq.db` by default, or `DATABASE_URL` in `.env`). Saved records survive closing and reopening. The server binds only to `127.0.0.1`, chooses a free port, and does not need an existing Terminal session. Schema migrations and a missing/outdated production build are prepared automatically with visible startup progress. A launch after source changes may take longer.

This is a native launcher for the local project. **Keep the project folder and its `node_modules` in place, and keep Node.js installed.** Building the launcher records the current project folder and Node.js location. You can move the app itself or add it to the Dock.

To build or reconnect the launcher after moving the project or changing Node.js (macOS 14+, with Xcode Command Line Tools), quit the app and run these once from the project folder:

```sh
npm run desktop:build
npm run desktop:install
```

The installer retains a previous launcher when updating. The local app is ad-hoc code-signed; the build does not require an Apple developer account. Startup logs are stored in `~/Library/Logs/InternshipHQ/desktop.log`.

## Browser setup / another checkout

Install **Node.js 22.12+ (Node 24 LTS recommended)** and npm. Run all commands from the project folder:

```sh
git clone https://github.com/z1t3ng-lab/InternshipHQ.git
cd InternshipHQ
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

Open **http://localhost:3000**. The server listens only on your laptop's loopback interface. Use Ctrl+C in its terminal to stop it. For an existing checkout, start from that project's folder and skip cloning. If `.env` already exists, keep it rather than overwriting it.

`db:init` safely creates the database file if missing, applies the committed migrations, and generates the Prisma client. Re-running it preserves existing data. It does **not** load demo records.

For a production build locally:

```sh
npm run build
npm start
```

The project uses Next's supported Webpack mode to avoid Turbopack's additional local compiler-port requirement in restricted environments. The lockfile pins the tested dependency versions. No remote fonts or image services are needed at runtime.

## What works

- Dashboard totals, active applications, submissions, interviews, offers, and an accessible status-distribution chart.
- Today panel and dedicated next-actions screen: overdue actions, today, next seven calendar days, and submission deadlines for Saved/Preparing applications.
- Quick entry with just company and position. Expand optional fields for links, location, work arrangement, term, dates, contacts, document filenames, and notes.
- Full editing with field-level validation; values remain in the form after an error. HTTP(S) URLs, email addresses, and calendar dates are validated on the server too.
- Search across company, position, location, and notes. Combine status, priority, term, and arrangement filters. Sort by company, deadline, date applied, next action date, or updated time, in either direction. Missing sort dates appear last.
- Table and responsive board views. Every card has a native keyboard-accessible status selector. All status transitions are allowed.
- Timestamped creation, edits, status transitions, imports, and completed actions. Completing an action can set the next action in the same transaction.
- Delete confirmation; deletion also deletes that application's history.
- Duplicate warnings for the same normalized company **and role**, or matching posting URL. Explicitly choose to save another record. Company name alone never triggers a merge.
- CSV column mapping, server-validated preview, clear import/skip reasons, export, and reimport.
- Desktop and mobile layouts, native modal focus trapping, focus restoration, Escape to close, visible focus, labeled controls, skip link, reduced-motion support, and status feedback.

### Definitions and dates

- **Total:** all stored applications.
- **Active:** every status except Offer, Rejected, and Withdrawn.
- **Submitted:** a record with a nonblank `dateApplied`, regardless of its current status. Changing status does not invent a date applied.
- **Interviews / offers:** the current status is Interview / Offer.
- **Overdue:** next action has a due date before today's calendar date in America/Toronto.
- **Next seven days:** tomorrow through today + 7, inclusive. Today is separate.
- **Submission reminders:** Saved or Preparing records with a deadline on/before today + 7; overdue deadlines are also retained.
- Terminal records are excluded from all action reminders. An action without a date stays in the application, without a timed alert.

Date-only fields are stored as exact `YYYY-MM-DD` strings (or empty strings). They are never converted to midnight timestamps. Activity and record timestamps use UTC instants and display in **America/Toronto**. The dashboard refreshes its calendar date every 30 seconds while open. Data is fetched from SQLite on page load; mutations return the stored record.

## Optional fictional demo

```sh
npm run demo
npm run dev:demo
```

Open **http://localhost:3001**. This always uses **prisma/demo.db**, completely separate from the personal database. The app displays a demo banner. Twelve clearly fictional applications cover all statuses, missing optional fields, an overdue task, and upcoming deadlines. Dates are relative to the day the demo is first seeded. Running `demo` again adds missing demo IDs without overwriting edits or re-dating existing demo records. To reset it, stop its server and delete only `prisma/demo.db` and any sidecar files, then run `npm run demo` again.

The `dev:demo` script uses POSIX environment-variable syntax (macOS/Linux). In PowerShell, run:

```powershell
$env:DATABASE_URL="file:./prisma/demo.db"
$env:DEMO_MODE="true"
npm run dev -- --port 3001
```

## CSV migration and export

1. In Google Sheets, select **File → Download → Comma-separated values (.csv)**. No Google connection is necessary.
2. Open **Import & export** and choose or drop your file. Download the example CSV from that screen if helpful.
3. Map source columns to application fields. Company and position must be mapped. Familiar names such as `Company Name`, `Role`, and `Job Title` are recognized automatically.
4. Preview. Each row is marked ready, duplicate, or invalid, with explanations. Expand a row to inspect all editable fields before saving.
5. Confirm **Import applications**. Invalid rows are skipped; duplicates are skipped by default. Explicitly check the duplicate option to create separate applications. Existing records are never overwritten or silently merged.

Files are limited to 5 MB and 2,000 rows per import. Invalid quote structure, duplicate column headers, and unsupported file structure block the whole file. Individual wrong-width rows, missing required values, invalid dates, invalid URLs/emails, and unknown enum values are identified in the preview. Status/priority/arrangement values are matched without case sensitivity; unknown nonblank values are not guessed. Blank status/priority/arrangement use Saved/Medium/Unspecified. Blank optional text and date fields remain blank.

Dates must use **YYYY-MM-DD**, such as `2027-05-01`. Ambiguous dates such as `05/01/2027` are rejected; format the relevant Google Sheets columns before export. Timestamps use ISO 8601 with a timezone, such as `2026-10-21T18:30:00.000Z`.

**Export all applications** includes every record, independent of table filters. The format is UTF-8 with a BOM, CRLF row separators, quoted cells, doubled embedded quotes, and preserved embedded newlines.

Export columns:

```text
company, position, jobUrl, location, arrangement, term, deadline,
dateApplied, status, priority, nextAction, nextActionDue, contactName,
contactEmail, resume, coverLetter, notes, sourceEmailUrl,
id, createdAt, updatedAt, activityHistory, formatVersion
```

`activityHistory` is a JSON array with `type`, `message`, and `createdAt`. `formatVersion` is `internshiphq-v1`. Text beginning with formula-sensitive characters (`=`, `+`, `-`, `@`, tab, CR, or LF, including after whitespace) or an apostrophe is prefixed with an apostrophe for spreadsheet safety. The importer removes this reversible escape **only** for rows marked with our format version. Keep this column intact. Re-exporting through spreadsheet software may alter dates or quotes; keep the original downloaded file for lossless backup.

**Restore CSV into an empty database:** use a new database filename in `.env`, run `npm run db:init`, restart, and import the untouched export. Fields, original IDs, record timestamps, and historical event content/times are restored; one new import event is appended. Internal activity IDs are regenerated. When importing into a populated database, existing IDs are treated as duplicates. If explicitly importing duplicate copies, conflicting record IDs are regenerated. No replacement mode is implemented.

## Database backup and restore

Personal data lives in `prisma/internshiphq.db` by default. It survives refreshes, server restarts, and builds. `.env`, database files, backup files, generated Prisma code, and browser test output are ignored by Git.

Create a consistent backup, even while the app is running:

```sh
npm run db:backup
```

This uses SQLite's backup API, includes application history and migration metadata, and prints the timestamped file under `backups/`. Protect that file as personal data. CSV is a portable alternate backup, but SQLite backup preserves all internal IDs and database metadata exactly.

To restore without overwriting your current database:

1. Stop the app.
2. Copy your backup to a new path, such as `prisma/restored.db`.
3. Set `DATABASE_URL="file:./prisma/restored.db"` in `.env`.
4. Run `npm run db:init`, then `npm run dev`.

Relative database paths resolve from the project root in both Prisma migrations and the app. Always run commands from that directory.

### Schema changes

Edit `prisma/schema.prisma`, then run:

```sh
npm run db:migrate -- --name describe_your_change
```

Review and commit the generated SQL migration. Other checkouts apply it with `npm run db:init`. Do not use database reset against personal records. Back up before schema changes.

## Verification

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:restart
npm run test:desktop
```

If Chrome is already installed, skip browser download and use:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

The data tests use a temporary SQLite database and read records from a separate process to check persistence. Browser tests launch the production build on port **3100** with another temporary database. The restart test uses port **3102** to create a record, stop Next.js completely, start it again, and compare all fields and history. The desktop test uses free localhost ports and a temporary database to check initialization, same-origin saves, CSV export, shutdown when the parent pipe closes, and persistence after reopening. Tests remove only their temporary databases when finished. Keep ports 3100 and 3102 free. Screenshots and failure traces are placed in ignored `test-results/`.

Tests cover validation, leap days, Toronto midnight/DST behavior, date-only formatting across timezones, metrics, reminders, combined filters/sorting, duplicate detection, malformed/quoted CSV, formula-safe CSV round trips, actual SQLite create/edit/delete, atomic status history, action completion, import skip/copy behavior, full restore, UI flows, keyboard focus, mobile layouts, and axe accessibility scans.

## How the source fits together

```text
src/app/                 Next.js page, layout, styles, and HTTP API routes
src/components/          Dashboard, table/board, forms, CSV wizard, navigation
src/lib/domain.ts        Shared types, validation, dates, metrics, filters
src/lib/db.ts            Prisma client and local SQLite connection
src/lib/applications.ts  Transactional writes and history
src/lib/csv.ts           CSV parsing, mapping, row validation, safe export
src/lib/importer.ts      Transactional preview/import and duplicate policy
src/lib/http.ts          JSON request checks and user-facing API errors
src/lib/email/           Future provider/parser contracts (not active)
prisma/                  Schema and committed SQL migrations
scripts/                 DB initialization, fictional demo, backup, test server
desktop/                 Native Swift/WebKit launcher and its local Node server
tests/                   Focused data tests and browser workflows
docs/email-integration.md Phase-two design and connection points
```

The client loads applications through `/api/applications`. It computes small personal-workspace views from those stored records; writes always go through server validation and Prisma. There is no browser-local copy used as the source of truth. The chart is simple labeled HTML/CSS, so a charting dependency is unnecessary. Run `npm run format` to format source files.

## Email integration and limitations

Gmail is **not implemented or connected**. `src/lib/email/provider.ts` defines the future read-only provider and suggestion-parser interfaces. [The phase-two notes](docs/email-integration.md) describe OAuth, evidence, review, idempotency, and scheduling. There is no fake Connect Gmail button, simulated email check, or dependency on ChatGPT's Gmail connection.

This is a one-user laptop application, without authentication, multi-device synchronization, or public deployment. Keep it bound to localhost. Board movement uses accessible native selects; drag-and-drop is intentionally absent. Resume and cover-letter fields store filenames/versions, not uploaded attachments. Import appends or skips; it never overwrites records. Calendar dates and blank values are preserved, and no employer information is fetched or invented. Existing open tabs need a refresh to pick up changes made in another tab. The app does not send email or schedule interviews.
