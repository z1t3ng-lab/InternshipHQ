# Verification record

Verified locally on October 21, 2026, with Node 24.21.0, Next.js 16.4.2, React 19.3.1, Prisma 7.10.1, and Chrome through Playwright.

| Check | Result |
| --- | --- |
| `npm test` | 11 tests passed |
| `npm run typecheck` | Passed |
| `npm run build` | Production build passed |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 4 browser workflows passed |
| `npm run test:restart` | Full server stop/start preserved all saved fields and history; cross-origin write rejected |
| `npm run db:backup` | Created a consistent SQLite backup |
| Default workspace | Initialized successfully with 0 records |
| Separate demo workspace | Initialized successfully with 12 fictional records |
| `npm run test:desktop` | Automatic initialization, free localhost port, same-origin saves, export, pipe-close shutdown, and database persistence passed |
| `npm run desktop:build` | Swift/WebKit app compiled; icon packaged; ad-hoc signature verified |
| Installed macOS app | Opened through `~/Desktop/InternshipHQ.app`; dashboard rendered; ⌘N and ⌘I worked |
| Native CSV dialogs | File picker opened/cancelled; Save dialog wrote a valid UTF-8 CSV export |
| Native quit and reopen | ⌘Q stopped the app-owned server (connection refused); Desktop shortcut reopened on a new free port |

Data tests exercise valid and invalid dates, leap days, Toronto midnight and daylight saving boundaries, date-only formatting across four timezones, documented metrics, terminal-status reminder suppression, combined filters and sorting, duplicate rules, CSV quote/newline handling, formula escaping, invalid rows, all editable fields, timestamps and history round trips, transactional writes, action completion, deletion cascades, and restoration into an empty database.

Browser workflows cover inline validation and retained inputs, creation, refresh persistence, status changes without data loss, history, action completion, delete confirmation/cancellation, combined filtering, sorting controls, board movement, dashboard counts, CSV preview with valid/invalid/duplicate rows, confirmed import, export download, and explicit duplicate creation. Keyboard checks cover skip navigation, modal focus trapping, Escape, and focus restoration.

Automated axe checks reported no WCAG 2 A/AA or WCAG 2.1 AA violations in the tested desktop empty dashboard, mobile empty dashboard, populated dashboard/table/board/today/import/email screens, and duplicate-warning dialog. This is a targeted automated check, not a comprehensive accessibility certification. Layout checks cover a 375px phone, 812px landscape viewport, and 1280/1440px desktop views. Desktop and phone screenshots were visually inspected; live personal and demo workspaces were also checked in the Codex browser.

All browser and data test records were isolated in temporary databases. The personal database remained empty. The demo stays separate in `prisma/demo.db`; its records are explicitly fictional.

The desktop checks ran on Apple Silicon macOS 27.0.1. The installed app references the existing project and Node executable; it is not a standalone bundle. The native CSV export check saved only the empty personal workspace's column headers to ignored `test-results/desktop-export-check.csv`. The macOS window was visually inspected and captured in `docs/internshiphq-desktop.png`.

Not tested against live Gmail, since that integration is intentionally not implemented. No public deployment or multi-user behavior was tested or included.
