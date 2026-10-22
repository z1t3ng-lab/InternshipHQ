# Gmail integration — phase two, not implemented

The core tracker works independently. No OAuth client, mailbox reader, parser, token store, scheduler, or Gmail API call is active. ChatGPT's Gmail connector is not available to this app automatically.

## Existing connection points

- `src/lib/email/provider.ts`: `ReadOnlyEmailProvider`, `EmailMessage`, `EmailSuggestionParser`, and `EmailSuggestion` contracts. These are types only, not simulated implementations.
- `src/lib/domain.ts`: validate accepted fields with `applicationSchema`; preserve missing values as unknown/blank.
- `src/lib/applications.ts`: use the audited transactional write functions after human review.
- `sourceEmailUrl`: keeps a source link on an application today.
- `Activity`: records accepted updates; add a source message identifier and evidence reference in a future migration.

## Proposed implementation

1. Register a dedicated Google OAuth client. Add server-owned start/callback endpoints with state validation and PKCE as appropriate. Verify redirect URI and session binding. Use Gmail read-only access (`https://www.googleapis.com/auth/gmail.readonly`) only if reading message bodies is needed; reconsider narrower scopes if the final implementation needs less. Never request send, modify, or full-mail permissions.
2. Store encrypted refresh/access tokens only on the server. Keep the encryption key outside SQLite and version control. Refresh/revoke tokens safely, support disconnect and token deletion, and surface authorization failures. Never put tokens in client props, browser storage, application notes, logs, or exports.
3. Fetch relevant application correspondence. Track provider message IDs, thread IDs, received timestamps, and synchronization cursors. Default to excluding advertisements and newsletters. A job advertisement becomes a record only through an explicit user choice.
4. Parse English and French confirmations, assessments/deadlines, interview invitations, offers, and explicit rejections. Store exact source quotes supporting each proposed field. Treat email bodies as untrusted data; instructions in an email must not drive tools or application changes.
5. Build a separate review inbox with pending/accepted/dismissed suggestions. Show source email, evidence, proposed fields, and current record values. The user accepts, edits, or dismisses each suggestion before any application change. Missing information remains blank. Silence is never evidence of rejection.
6. Match using role, posting URL, application reference, thread, and explicit evidence. Company name alone is insufficient. Present ambiguous matches for review; do not automatically merge.
7. Add a `ProcessedEmail` table with a unique provider/account/message key and a suggestion table with a unique source-message/kind/version key. Commit accepted writes, review state, and processing metadata together. Replaying a message must not create duplicates. Dismissal should persist across checks; parser-version reprocessing requires a deliberate policy.
8. Only add periodic checks once an actual scheduler exists (for a local-only app, a documented OS scheduler or a long-running local worker). Record and display last attempted check, **last successful check**, cursor, and errors. Opening a screen or a running animation is not a successful check.

Tests should cover both languages, forwarded/quoted mail, timezones and ambiguous dates, multiple roles at one employer, duplicate messages, expired OAuth tokens, newsletter exclusion, ambiguous matches, dismissal replay, manual overrides, and transactional acceptance. No email sending or calendar scheduling is part of the planned scope.
