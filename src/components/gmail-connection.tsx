"use client";
import { useEffect, useState } from "react";
import { request } from "./ui";
import { formatTimestamp } from "@/lib/domain";
type GmailState = {
  configured: boolean;
  connected: boolean;
  email: string;
  automatic: boolean;
  query: string;
  lastAttempt?: string;
  lastSuccess?: string;
  error?: string;
  nextPageToken?: string;
  imported?: number;
  skipped?: number;
  syncing?: boolean;
  notice?: string;
};
export function GmailConnection({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const [state, setState] = useState<GmailState>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authUrl, setAuthUrl] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  async function load(initial = false) {
    const value = await request<GmailState>("/api/gmail");
    setState(value);
    if (initial) setQuery(value.query);
    if (value.connected) setAuthUrl("");
  }
  useEffect(() => {
    load(true).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!authUrl) return;
    const timer = setInterval(() => {
      load().catch((e) => setError(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [authUrl]);
  async function action(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function configure(file: File) {
    if (file.size > 50000)
      throw new Error(
        "Choose the small JSON credentials file downloaded from Google Cloud.",
      );
    let client;
    try {
      client = JSON.parse(await file.text());
    } catch {
      throw new Error("This file is not valid JSON.");
    }
    await request("/api/gmail", {
      method: "POST",
      body: JSON.stringify({ action: "configure", client }),
    });
    await load(true);
    setNotice("OAuth client saved on this Mac. You can connect Gmail now.");
  }
  return (
    <section className="card feature-panel">
      <div className="feature-row">
        <div>
          <h2>Gmail connection</h2>
          <p className="muted">
            {state?.connected
              ? `Connected to ${state.email} · Read-only access`
              : "Connect your mailbox to collect messages for review."}
          </p>
        </div>
        <span className="badge slate">
          {state?.connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p>
        Messages stay in your local workspace. Checking Gmail never changes an
        application until you accept its review.
      </p>
      {!state?.connected && (
        <details open={!state?.configured}>
          <summary>One-time Google setup</summary>
          <ol className="setup-steps">
            <li>
              Open{" "}
              <a
                className="text-link"
                href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud
              </a>
              , select or create your project, and enable the Gmail API.
            </li>
            <li>
              Configure the OAuth consent screen. If the app is in Testing, add
              your Gmail address as a test user. Add the Gmail read-only scope.
            </li>
            <li>
              Create an OAuth client of type <strong>Desktop app</strong> and
              download its JSON credentials.
            </li>
            <li>
              Import that file here, then connect Gmail and approve read-only
              access in your browser.
            </li>
          </ol>
          <label className="button">
            Import Google client JSON
            <input
              className="file-overlay"
              type="file"
              accept=".json,application/json"
              aria-label="Import Google client JSON"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void action(() => configure(file));
              }}
            />
          </label>
          <p className="small muted">
            Client settings and encrypted tokens stay on this Mac, outside
            database backups and GitHub. Google may require you to reconnect
            while your OAuth app is in Testing.
          </p>
          <a
            className="text-link"
            href="https://developers.google.com/identity/protocols/oauth2/native-app"
            target="_blank"
            rel="noreferrer"
          >
            Google’s desktop OAuth setup guide
          </a>
        </details>
      )}
      <div className="button-row">
        {state?.configured && (
          <button
            className="button"
            disabled={busy || state.syncing}
            onClick={() =>
              action(async () => {
                const result = await request<{ url: string }>("/api/gmail", {
                  method: "POST",
                  body: JSON.stringify({ action: "connect" }),
                });
                setAuthUrl(result.url);
              })
            }
          >
            {state.connected ? "Reconnect Gmail" : "Connect Gmail"}
          </button>
        )}
        {authUrl && (
          <a
            className="button primary"
            href={authUrl}
            target="_blank"
            rel="noreferrer"
          >
            Continue to Google in browser
          </a>
        )}
        {state?.connected && (
          <>
            <button
              className="button primary"
              disabled={busy || state.syncing}
              onClick={() =>
                action(async () => {
                  await request("/api/gmail", {
                    method: "POST",
                    body: JSON.stringify({ action: "sync" }),
                  });
                  await load();
                  await onImported();
                  setNotice(
                    "Gmail batch checked. Review any imported messages below.",
                  );
                })
              }
            >
              {busy || state.syncing
                ? "Checking…"
                : state.nextPageToken
                  ? "Check next batch"
                  : "Check Gmail"}
            </button>
            <button
              className="button"
              disabled={busy || state.syncing}
              onClick={() =>
                action(async () => {
                  const result = await request<GmailState>("/api/gmail", {
                    method: "POST",
                    body: JSON.stringify({ action: "disconnect" }),
                  });
                  setState(result);
                  setNotice(result.notice || "Gmail disconnected.");
                })
              }
            >
              Disconnect
            </button>
          </>
        )}
        <button
          className="button subtle"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await load();
              await onImported();
            })
          }
        >
          Refresh connection
        </button>
      </div>
      {state?.connected && (
        <>
          <label className="field">
            Gmail search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={1000}
            />
          </label>
          <div className="button-row">
            <button
              className="button"
              disabled={busy || !query.trim()}
              onClick={() =>
                action(async () => {
                  await request("/api/gmail", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "settings",
                      automatic: state.automatic,
                      query,
                    }),
                  });
                  await load();
                  setNotice("Gmail search saved.");
                })
              }
            >
              Save search
            </button>
            <label className="check-line">
              <input
                type="checkbox"
                checked={state.automatic}
                disabled={busy}
                onChange={(e) => {
                  const automatic = e.target.checked;
                  void action(async () => {
                    await request("/api/gmail", {
                      method: "POST",
                      body: JSON.stringify({
                        action: "settings",
                        automatic,
                        query: state.query,
                      }),
                    });
                    await load();
                  });
                }}
              />
              Check every 30 minutes while the app is running
            </label>
          </div>
        </>
      )}
      {state?.lastAttempt && (
        <p className="small muted">
          Last attempted check: {formatTimestamp(state.lastAttempt)}
        </p>
      )}
      {state?.lastSuccess && (
        <p className="small muted">
          Last successful batch: {formatTimestamp(state.lastSuccess)} ·{" "}
          {state.imported || 0} imported · {state.skipped || 0} skipped
          (oversized or unreadable)
        </p>
      )}
      {state?.nextPageToken && (
        <p className="small muted">
          More matching messages remain. Use Check next batch to continue.
        </p>
      )}
      {state?.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
    </section>
  );
}
