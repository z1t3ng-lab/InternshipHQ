# Email-assisted updates

Email updates are implemented as a local review inbox. Gmail is optional; pasted message text and `.eml` import work without a Google account or cloud configuration.

## Gmail setup in the app

1. Open **Email updates → One-time Google setup**.
2. In Google Cloud, select or create a project and enable the Gmail API.
3. Configure the OAuth consent screen and the Gmail read-only scope. Add your Gmail address as a test user if the project is in Testing.
4. Create an OAuth client with the **Desktop app** application type and download its credentials JSON.
5. Import the JSON in InternshipHQ, select **Connect Gmail**, then **Continue to Google in browser**. Approve read-only access and return to the app.
6. Choose **Check Gmail**. The default search covers the last 90 days and common English/French application terms, excluding sent mail, spam, and trash. Edit the Gmail search to narrow it or find older correspondence.

Each batch checks up to 25 matching messages. **Check next batch** continues pagination. Optional automatic checks run every 30 minutes while the local server is running. Nothing checks mail while the desktop app is closed. The screen reports last attempted check, last successful batch, imported/skipped counts, remaining pages, and errors separately. Oversized or unreadable messages can be pasted manually.

This app uses Google’s [desktop OAuth flow](https://developers.google.com/identity/protocols/oauth2/native-app) with a loopback redirect, PKCE S256, expiring single-use state, and the system browser. Only `gmail.readonly` is requested. [Gmail list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list) and [get](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get) fetch messages; no send, modify, delete, or calendar API is used.

## Local credentials and privacy

OAuth client configuration, a 256-bit encryption key, encrypted access/refresh tokens, and check preferences live under `.private-gmail/<database-filename>/` next to the database. Directory permissions are 0700 and file permissions 0600. Tokens use AES-256-GCM with the key in a separate file. This protects against accidentally reading or copying the token file alone; a process that can read both files can decrypt it. The entire directory is ignored by Git and excluded from database backups. Never commit a downloaded client credentials file.

Disconnect revokes the grant when Google is reachable and deletes local tokens and the key. If revocation is unavailable, the screen directs you to revoke the app in Google account permissions. Local email review history remains available. Testing-mode Google projects may require periodic reconnection. Backups restore review history, but Gmail must be connected separately on another Mac.

## Review behavior

- Rules recognize common English/French confirmations, assessments, interview invitations, offers, and explicit rejections. They are suggestions, not a general language model.
- Evidence is shown next to the suggested status. Conflicting evidence, newsletters/job alerts, and unrecognized wording require manual review. Quoted replies and common forwarded-message blocks are excluded from classification.
- MIME import supports plain text, multipart alternatives, Base64, quoted-printable, encoded headers, and a plain-text conversion of HTML. HTML is never rendered or executed; attachments are not imported. Maximum `.eml` size is 1 MB; message text is limited to 100,000 characters.
- The user selects an existing application, checks current versus proposed status, optionally enters a next action and confirmed date, and accepts or dismisses. A company/role hint never automatically selects or merges a record.
- Accepting updates the application, audit trail, structured status history, and review decision in one transaction. A stale application prevents acceptance until it is reviewed again. No date is inferred from silence or an ambiguous phrase.
- Message content fingerprints and per-account Gmail message IDs prevent duplicate work. Accepted and dismissed reviews remain processed on future checks.
- Dates/times in email do not automatically create interview appointments. Confirm those explicitly in Interview planner, including the time zone.

## Validation

Automated tests simulate Google consent-code exchange, PKCE/state validation, token encryption and refresh, multiple result pages, duplicate imports, expired access, and disconnect. Live Google consent requires the user’s own Desktop OAuth client and account approval and is not claimed as verified until that connection is made.
