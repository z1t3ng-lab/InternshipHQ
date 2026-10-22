import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { z } from "zod";
import { databasePath } from "../backups";
import { HttpError } from "../http";
import { db } from "../db";
import { importEmail } from "./reviews";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const DEFAULT_QUERY =
  "newer_than:90d -in:spam -in:trash -in:sent {application interview assessment offer candidature entretien}";
type Config = { clientId: string; clientSecret: string };
type Tokens = {
  access: string;
  refresh: string;
  expires: number;
  email: string;
};
type SyncState = {
  automatic: boolean;
  query: string;
  nextPageToken?: string;
  lastAttempt?: string;
  lastSuccess?: string;
  error?: string;
  imported?: number;
  skipped?: number;
};
const globals = globalThis as unknown as {
  hqOAuth?: Map<
    string,
    { verifier: string; redirect: string; expires: number }
  >;
  hqGmailSync?: Promise<SyncState>;
  hqGmailTimer?: ReturnType<typeof setInterval>;
  hqGmailAuthBusy?: boolean;
};
const directory = () =>
  join(dirname(databasePath()), ".private-gmail", basename(databasePath()));
function ensure() {
  mkdirSync(directory(), { recursive: true, mode: 0o700 });
}
function read<T>(name: string): T | undefined {
  try {
    return JSON.parse(readFileSync(join(directory(), name), "utf8"));
  } catch {
    return undefined;
  }
}
function write(name: string, value: unknown) {
  ensure();
  const temp = join(directory(), `${randomUUID()}.tmp`);
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  renameSync(temp, join(directory(), name));
}
function encryptionKey() {
  ensure();
  const path = join(directory(), "encryption.key");
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (e) {
      if (!existsSync(path)) throw e;
    }
  }
  return readFileSync(path);
}
function saveTokens(value: Tokens) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  write("tokens.json", {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}
function tokens(): Tokens | undefined {
  const saved = read<{ iv: string; tag: string; data: string }>("tokens.json");
  if (!saved) return;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(saved.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(saved.data, "base64")),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    throw new HttpError(
      409,
      "The local Gmail credentials could not be unlocked. Disconnect and connect Gmail again.",
    );
  }
}
export function gmailState(): SyncState {
  return {
    automatic: false,
    query: DEFAULT_QUERY,
    ...read<SyncState>("sync.json"),
  };
}
function updateState(patch: Partial<SyncState>) {
  const value = { ...gmailState(), ...patch };
  write("sync.json", value);
  return value;
}
export function gmailStatus() {
  let saved: Tokens | undefined;
  let tokenError = "";
  try {
    saved = tokens();
  } catch (e) {
    tokenError = (e as Error).message;
  }
  return {
    configured: !!read<Config>("client.json"),
    connected: !!saved,
    email: saved?.email || "",
    ...gmailState(),
    ...(tokenError ? { error: tokenError } : {}),
    syncing: !!globals.hqGmailSync,
  };
}
export function configureGmail(raw: unknown) {
  if (globals.hqGmailSync || globals.hqGmailAuthBusy)
    throw new HttpError(409, "Wait for the current Gmail operation to finish.");
  const config = z
    .object({
      installed: z.object({
        client_id: z.string().regex(/^[\w.-]+\.apps\.googleusercontent\.com$/),
        client_secret: z.string().min(1).max(500),
      }),
    })
    .safeParse(raw);
  if (!config.success)
    throw new HttpError(
      400,
      "Choose the JSON credentials for a Google OAuth Desktop app client.",
    );
  if (tokens())
    throw new HttpError(
      409,
      "Disconnect Gmail before replacing its OAuth client.",
    );
  globals.hqOAuth?.clear();
  write("client.json", {
    clientId: config.data.installed.client_id,
    clientSecret: config.data.installed.client_secret,
  });
  return gmailStatus();
}
export function configureGmailSync(raw: unknown) {
  if (globals.hqGmailSync)
    throw new HttpError(409, "Wait for the current Gmail check to finish.");
  const data = z
    .object({
      automatic: z.boolean(),
      query: z.string().trim().min(1).max(1000),
    })
    .parse(raw);
  updateState({
    ...data,
    ...(data.query !== gmailState().query ? { nextPageToken: "" } : {}),
  });
  return gmailStatus();
}
export function startGmailConnection(origin: string) {
  const config = read<Config>("client.json");
  if (!config)
    throw new HttpError(
      400,
      "Import your Google Desktop OAuth client JSON first.",
    );
  const url = new URL(origin);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.protocol !== "http:"
  )
    throw new HttpError(400, "Connect Gmail from the local InternshipHQ app.");
  const redirect = `http://127.0.0.1:${url.port || "80"}/api/gmail/callback`;
  const verifier = randomBytes(32).toString("base64url"),
    state = randomBytes(32).toString("base64url");
  globals.hqOAuth ||= new Map();
  for (const [key, value] of globals.hqOAuth)
    if (value.expires < Date.now()) globals.hqOAuth.delete(key);
  globals.hqOAuth.set(state, {
    verifier,
    redirect,
    expires: Date.now() + 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPE,
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}
async function googleJson(url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new HttpError(
      502,
      "Could not reach Google. Check your connection and try again.",
    );
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new HttpError(
          413,
          "This email is too large to import. Paste its text instead.",
        );
      }
      chunks.push(value);
    }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    body = {};
  }
  if (!response.ok) {
    if (response.status === 401 || body.error === "invalid_grant")
      throw new HttpError(
        401,
        "Gmail access expired or was revoked. Connect Gmail again.",
      );
    if (response.status === 403)
      throw new HttpError(
        403,
        "Google denied Gmail access. Enable the Gmail API and check your OAuth test-user and permission settings.",
      );
    if (response.status === 429)
      throw new HttpError(
        429,
        "Google is limiting requests. Wait a few minutes before checking again.",
      );
    throw new HttpError(
      502,
      "Google could not complete the request. Check the OAuth client setup and try again.",
    );
  }
  return body;
}
export async function finishGmailConnection(
  state: string,
  code: string,
  denied: boolean,
) {
  const pending = globals.hqOAuth?.get(state);
  globals.hqOAuth?.delete(state);
  if (!pending || pending.expires < Date.now())
    throw new HttpError(
      400,
      "This sign-in link expired or was already used. Start Connect Gmail again in InternshipHQ.",
    );
  if (denied)
    throw new HttpError(
      400,
      "Gmail access was not granted. You can still paste or import emails.",
    );
  if (globals.hqGmailSync || globals.hqGmailAuthBusy)
    throw new HttpError(
      409,
      "A Gmail operation is in progress. Try connecting again after it finishes.",
    );
  globals.hqGmailAuthBusy = true;
  try {
    const config = read<Config>("client.json")!;
    const token = await googleJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: pending.verifier,
        redirect_uri: pending.redirect,
        grant_type: "authorization_code",
      }),
    });
    if (
      !token.access_token ||
      !token.refresh_token ||
      !String(token.scope || "")
        .split(" ")
        .includes(SCOPE)
    )
      throw new HttpError(
        400,
        "Read-only Gmail access was not granted. Connect again and allow the requested scope.",
      );
    const profile = await googleJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    saveTokens({
      access: token.access_token,
      refresh: token.refresh_token,
      expires: Date.now() + Number(token.expires_in) * 1000,
      email: profile.emailAddress,
    });
    globals.hqOAuth?.clear();
    updateState({
      error: "",
      nextPageToken: "",
      lastAttempt: undefined,
      lastSuccess: undefined,
      imported: 0,
      skipped: 0,
    });
  } finally {
    globals.hqGmailAuthBusy = false;
  }
}
async function accessToken() {
  const saved = tokens();
  if (!saved) throw new HttpError(400, "Connect Gmail first.");
  if (saved.expires > Date.now() + 60000) return saved;
  const config = read<Config>("client.json")!;
  const token = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: saved.refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!token.access_token)
    throw new HttpError(401, "Connect Gmail again to renew access.");
  const updated = {
    ...saved,
    access: token.access_token,
    expires: Date.now() + Number(token.expires_in) * 1000,
  };
  saveTokens(updated);
  return updated;
}
export async function disconnectGmail() {
  if (globals.hqGmailSync || globals.hqGmailAuthBusy)
    throw new HttpError(409, "Wait for the current Gmail operation to finish.");
  globals.hqGmailAuthBusy = true;
  try {
    let saved: Tokens | undefined;
    try {
      saved = tokens();
    } catch {}
    let revoked = true;
    if (saved) {
      try {
        const result = await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          body: new URLSearchParams({ token: saved.refresh || saved.access }),
          signal: AbortSignal.timeout(10000),
        });
        revoked = result.ok || result.status === 400;
      } catch {
        revoked = false;
      }
    }
    for (const file of ["tokens.json", "encryption.key"]) {
      const path = join(directory(), file);
      if (existsSync(path)) unlinkSync(path);
    }
    globals.hqOAuth?.clear();
    updateState({
      automatic: false,
      nextPageToken: "",
      error: "",
      lastSuccess: undefined,
      lastAttempt: undefined,
    });
    return {
      ...gmailStatus(),
      notice: revoked
        ? "Gmail disconnected. Local review history is retained."
        : "Local Gmail credentials removed. Google could not be reached; revoke InternshipHQ in your Google account permissions as well.",
    };
  } finally {
    globals.hqGmailAuthBusy = false;
  }
}
export async function syncGmail() {
  if (globals.hqGmailAuthBusy)
    throw new HttpError(409, "Finish connecting Gmail first.");
  if (globals.hqGmailSync) return globals.hqGmailSync;
  globals.hqGmailSync = (async () => {
    updateState({ lastAttempt: new Date().toISOString(), error: "" });
    try {
      const token = await accessToken(),
        settings = gmailState();
      const headers = { Authorization: `Bearer ${token.access}` };
      const params = new URLSearchParams({
        q: settings.query,
        maxResults: "25",
        ...(settings.nextPageToken
          ? { pageToken: settings.nextPageToken }
          : {}),
      });
      const page = await googleJson(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
        { headers },
      );
      let imported = 0,
        skipped = 0;
      for (const message of page.messages || []) {
        const key = createHash("sha256")
          .update(`${token.email}:${message.id}`)
          .digest("hex");
        if (await db.gmailMessage.findUnique({ where: { key } })) continue;
        let reviewId = "";
        try {
          const raw = await googleJson(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?format=raw`,
            { headers },
          );
          if (!raw.raw || raw.raw.length > 1_400_000)
            throw new HttpError(413, "Email too large");
          const result = await importEmail({
            eml: Buffer.from(raw.raw, "base64url").toString("utf8"),
            sourceUrl: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(token.email)}#all/${encodeURIComponent(message.id)}`,
          });
          reviewId = result.id;
          imported++;
        } catch (e) {
          if (e instanceof HttpError && [400, 413].includes(e.status))
            skipped++;
          else throw e;
        }
        await db.gmailMessage.create({
          data: { key, messageId: message.id, reviewId },
        });
      }
      return updateState({
        lastSuccess: new Date().toISOString(),
        nextPageToken: page.nextPageToken || "",
        imported,
        skipped,
        error: "",
      });
    } catch (e) {
      updateState({
        error:
          e instanceof HttpError ? e.message : "Gmail check failed. Try again.",
      });
      throw e;
    }
  })();
  try {
    return await globals.hqGmailSync;
  } finally {
    globals.hqGmailSync = undefined;
  }
}
export function startGmailScheduler() {
  if (globals.hqGmailTimer) return;
  const check = () => {
    const s = gmailState();
    if (
      s.automatic &&
      (!s.lastAttempt ||
        Date.now() - Date.parse(s.lastAttempt) >= 30 * 60 * 1000)
    )
      void syncGmail().catch(() => {});
  };
  check();
  globals.hqGmailTimer = setInterval(check, 60000);
  globals.hqGmailTimer.unref();
}
