import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { migrateTestDatabase } from "../scripts/migrate-test-db";

test("Gmail PKCE, encrypted credentials, refresh, paginated import, replay safety and disconnection", async () => {
  const dir = mkdtempSync(join(tmpdir(), "internshiphq-gmail-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  const sqlite = new Database(join(dir, "test.db"));
  migrateTestDatabase(sqlite);
  sqlite.close();
  const { db } = await import("../src/lib/db");
  const gmail = await import("../src/lib/email/gmail");
  const originalFetch = globalThis.fetch;
  let refreshes = 0,
    denied = false,
    pageCalls = 0,
    messageCalls = 0;
  const calls: string[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
      const form = init?.body as URLSearchParams;
      if (form.get("grant_type") === "refresh_token") {
        refreshes++;
        return json({
          access_token: "refreshed-token-for-test",
          expires_in: 3600,
        });
      }
      assert.ok(form.get("code_verifier"));
      assert.equal(
        form.get("redirect_uri"),
        "http://127.0.0.1:3100/api/gmail/callback",
      );
      return json({
        access_token: "access-token-for-test",
        refresh_token: "refresh-token-for-test",
        expires_in: 0,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
      });
    }
    if (url.endsWith("/profile"))
      return json({ emailAddress: "test@example.test" });
    if (url.includes("/messages?")) {
      pageCalls++;
      if (denied) return json({ error: { message: "revoked" } }, 401);
      const p = new URL(url).searchParams;
      assert.equal(p.get("maxResults"), "25");
      return json({
        messages: [{ id: p.get("pageToken") ? "message2" : "message1" }],
        ...(p.get("pageToken") ? {} : { nextPageToken: "next-page" }),
      });
    }
    if (url.includes("/messages/message")) {
      messageCalls++;
      return json({
        raw: Buffer.from(
          `Subject: Application ${url.includes("message2") ? "two" : "one"}\nFrom: hiring@example.test\nContent-Type: text/plain\n\nWe invite you to an interview.`,
        ).toString("base64url"),
      });
    }
    if (url === "https://oauth2.googleapis.com/revoke") return json({});
    throw new Error(`Unexpected external call: ${url}`);
  };
  try {
    assert.throws(
      () => gmail.configureGmail({ web: { client_id: "test" } }),
      /Desktop/,
    );
    gmail.configureGmail({
      installed: {
        client_id: "fixture.apps.googleusercontent.com",
        client_secret: "public-desktop-test-secret",
      },
    });
    const connect = new URL(
      gmail.startGmailConnection("http://127.0.0.1:3100").url,
    );
    assert.equal(
      connect.searchParams.get("scope"),
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    assert.equal(connect.searchParams.get("code_challenge_method"), "S256");
    assert.ok(connect.searchParams.get("code_challenge"));
    await assert.rejects(
      gmail.finishGmailConnection("invalid", "code", false),
      /expired/,
    );
    await gmail.finishGmailConnection(
      connect.searchParams.get("state")!,
      "code",
      false,
    );
    assert.equal(gmail.gmailStatus().connected, true);
    assert.equal(gmail.gmailStatus().email, "test@example.test");
    await assert.rejects(
      gmail.finishGmailConnection(
        connect.searchParams.get("state")!,
        "code",
        false,
      ),
      /already used/,
    );
    const tokenPath = join(dir, ".private-gmail/test.db/tokens.json");
    const encrypted = readFileSync(tokenPath, "utf8");
    assert.doesNotMatch(
      encrypted,
      /access-token-for-test|refresh-token-for-test|test@example/,
    );
    assert.equal(statSync(tokenPath).mode & 0o777, 0o600);
    const first = await gmail.syncGmail();
    assert.equal(first.imported, 1);
    assert.equal(first.nextPageToken, "next-page");
    assert.equal(refreshes, 1);
    await gmail.syncGmail();
    assert.equal(await db.emailReview.count(), 2);
    assert.equal(gmail.gmailStatus().nextPageToken, "");
    const firstReview = await db.emailReview.findFirstOrThrow();
    await db.emailReview.update({
      where: { id: firstReview.id },
      data: { state: "dismissed" },
    });
    await gmail.syncGmail();
    assert.equal(messageCalls, 2);
    assert.equal(await db.emailReview.count(), 2);
    assert.equal(
      (
        await db.emailReview.findUniqueOrThrow({
          where: { id: firstReview.id },
        })
      ).state,
      "dismissed",
    );
    const success = gmail.gmailStatus().lastSuccess;
    denied = true;
    await assert.rejects(gmail.syncGmail(), /expired or was revoked/);
    assert.equal(gmail.gmailStatus().lastSuccess, success);
    assert.match(gmail.gmailStatus().error || "", /revoked/);
    const disconnecting = gmail.disconnectGmail();
    await assert.rejects(gmail.syncGmail(), /Finish connecting Gmail first/);
    const disconnected = await disconnecting;
    assert.equal(disconnected.connected, false);
    assert.equal(disconnected.automatic, false);
    assert.equal(await db.emailReview.count(), 2);
    assert.ok(
      calls.every(
        (url) =>
          url.startsWith("https://gmail.googleapis.com/") ||
          url.startsWith("https://oauth2.googleapis.com/"),
      ),
    );
    assert.equal(pageCalls, 4);
  } finally {
    globalThis.fetch = originalFetch;
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
