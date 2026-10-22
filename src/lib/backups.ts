import Database from "better-sqlite3";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  statSync,
  existsSync,
  lstatSync,
} from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./http";

const tables = [
  "Document",
  "Application",
  "Activity",
  "Interview",
  "StatusEvent",
  "EmailReview",
  "GmailMessage",
] as const;
export function databasePath() {
  return resolve(
    (process.env.DATABASE_URL || "file:./prisma/internshiphq.db").replace(
      /^file:/,
      "",
    ),
  );
}
export function backupDirectory() {
  return join(
    dirname(databasePath()),
    "backups",
    basename(databasePath(), ".db"),
  );
}
function ensureDirectory() {
  mkdirSync(backupDirectory(), { recursive: true, mode: 0o700 });
}
type Settings = {
  enabled: boolean;
  lastAttempt?: string;
  lastSuccess?: string;
  error?: string;
};
export function backupSettings(): Settings {
  try {
    return {
      enabled: true,
      ...JSON.parse(
        readFileSync(join(backupDirectory(), "settings.json"), "utf8"),
      ),
    };
  } catch {
    return { enabled: true };
  }
}
export function saveBackupSettings(patch: Partial<Settings>) {
  ensureDirectory();
  const value = { ...backupSettings(), ...patch };
  const temp = join(backupDirectory(), `${randomUUID()}.json.tmp`);
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  renameSync(temp, join(backupDirectory(), "settings.json"));
  return value;
}
export function backupPath(name: string) {
  if (!/^internshiphq-(auto|manual|recovery|import)-[\w-]+\.db$/.test(name))
    throw new HttpError(400, "Choose a backup from this workspace.");
  const path = join(backupDirectory(), name);
  if (!existsSync(path) || !lstatSync(path).isFile())
    throw new HttpError(404, "This backup no longer exists.");
  return path;
}
function newName(kind: string) {
  return `internshiphq-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.db`;
}
export function listBackups() {
  ensureDirectory();
  return readdirSync(backupDirectory())
    .filter((name) =>
      /^internshiphq-(auto|manual|recovery|import)-[\w-]+\.db$/.test(name),
    )
    .map((name) => {
      const info = statSync(backupPath(name));
      return {
        name,
        kind: name.split("-")[1],
        size: info.size,
        createdAt: info.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
let pending: Promise<string> | undefined;
export async function createBackup(kind: "auto" | "manual" = "manual") {
  if (pending) return pending;
  pending = (async () => {
    ensureDirectory();
    const name = newName(kind),
      path = join(backupDirectory(), name);
    const reader = new Database(databasePath(), {
      readonly: true,
      fileMustExist: true,
    });
    try {
      await reader.backup(`${path}.partial`);
      renameSync(`${path}.partial`, path);
      // Only scheduled backups expire. Manual and recovery copies are retained.
      if (kind === "auto")
        for (const old of listBackups()
          .filter((b) => b.kind === "auto")
          .slice(14))
          unlinkSync(backupPath(old.name));
      return name;
    } finally {
      reader.close();
      if (existsSync(`${path}.partial`)) unlinkSync(`${path}.partial`);
    }
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
export async function automaticBackup() {
  const settings = backupSettings();
  if (
    !settings.enabled ||
    (settings.lastSuccess &&
      Date.now() - Date.parse(settings.lastSuccess) < 86400000)
  )
    return;
  saveBackupSettings({ lastAttempt: new Date().toISOString() });
  try {
    await createBackup("auto");
    saveBackupSettings({ lastSuccess: new Date().toISOString(), error: "" });
  } catch {
    saveBackupSettings({
      error:
        "The automatic backup failed. Check available disk space and try Back up now.",
    });
  }
}
const scheduler = globalThis as unknown as {
  internshipBackupTimer?: ReturnType<typeof setInterval>;
};
export function startBackupScheduler() {
  if (scheduler.internshipBackupTimer) return;
  void automaticBackup().catch(() =>
    console.error("Automatic backup could not write to its local folder."),
  );
  scheduler.internshipBackupTimer = setInterval(
    () => {
      void automaticBackup().catch(() =>
        console.error("Automatic backup could not write to its local folder."),
      );
    },
    60 * 60 * 1000,
  );
  scheduler.internshipBackupTimer.unref();
}
function inspect(path: string) {
  let reader: Database.Database | undefined;
  try {
    reader = new Database(path, { readonly: true, fileMustExist: true });
    const names = new Set(
      (
        reader
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all() as { name: string }[]
      ).map((r) => r.name),
    );
    const columns = (table: string) =>
      (
        reader!.prepare(`PRAGMA table_info("${table}")`).all() as {
          name: string;
        }[]
      ).map((r) => r.name);
    if (
      !names.has("Application") ||
      ![
        "id",
        "company",
        "position",
        "status",
        "dateApplied",
        "createdAt",
        "updatedAt",
      ].every((c) => columns("Application").includes(c)) ||
      !names.has("Activity")
    )
      throw new Error("signature");
    if (reader.pragma("quick_check", { simple: true }) !== "ok")
      throw new Error("integrity");
    if ((reader.pragma("foreign_key_check") as unknown[]).length)
      throw new Error("relationships");
    const counts = Object.fromEntries(
      tables.map((table) => [
        table,
        names.has(table)
          ? (
              reader!.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as {
                n: number;
              }
            ).n
          : 0,
      ]),
    );
    return {
      counts,
      names,
      columns: Object.fromEntries(tables.map((t) => [t, columns(t)])),
    };
  } catch {
    throw new HttpError(
      400,
      "This file is not a valid InternshipHQ backup. Your workspace has not changed.",
    );
  } finally {
    reader?.close();
  }
}
export function previewBackup(name: string) {
  return { name, counts: inspect(backupPath(name)).counts };
}
export function importBackup(bytes: Buffer) {
  if (
    bytes.length > 250 * 1024 * 1024 ||
    bytes.length < 16 ||
    bytes.subarray(0, 16).toString() !== "SQLite format 3\0"
  )
    throw new HttpError(
      400,
      "Choose an InternshipHQ SQLite backup up to 250 MB.",
    );
  ensureDirectory();
  const name = newName("import"),
    path = join(backupDirectory(), name);
  writeFileSync(path, bytes, { mode: 0o600, flag: "wx" });
  try {
    return previewBackup(name);
  } catch (e) {
    unlinkSync(path);
    throw e;
  }
}
export function restoreBackup(name: string) {
  if ((globalThis as unknown as { hqGmailSync?: unknown }).hqGmailSync)
    throw new HttpError(
      409,
      "Wait for the Gmail check to finish before restoring.",
    );
  const path = backupPath(name),
    preview = inspect(path);
  const live = new Database(databasePath(), { fileMustExist: true });
  const recoveryName = newName("recovery");
  try {
    live.pragma("foreign_keys = ON");
    live.prepare("ATTACH DATABASE ? AS snapshot").run(path);
    live
      .transaction(() => {
        // The write lock spans the recovery snapshot and replacement, so a second
        // app instance cannot save data between them. serialize includes WAL pages.
        writeFileSync(join(backupDirectory(), recoveryName), live.serialize(), {
          flag: "wx",
          mode: 0o600,
        });
        for (const table of [...tables].reverse())
          live.prepare(`DELETE FROM "${table}"`).run();
        for (const table of tables) {
          if (!preview.names.has(table)) continue;
          const current = (
            live.prepare(`PRAGMA main.table_info("${table}")`).all() as {
              name: string;
            }[]
          ).map((r) => r.name);
          if (preview.columns[table].some((c) => !current.includes(c)))
            throw new HttpError(
              400,
              "This backup needs a newer version of InternshipHQ. Your workspace has not changed.",
            );
          const columns = current
            .filter((c) => preview.columns[table].includes(c))
            .map((c) => `"${c}"`)
            .join(",");
          live
            .prepare(
              `INSERT INTO main."${table}" (${columns}) SELECT ${columns} FROM snapshot."${table}"`,
            )
            .run();
        }
        if ((live.pragma("foreign_key_check") as unknown[]).length)
          throw new Error("Invalid relationships");
      })
      .immediate();
    return { restored: true, recoveryName, counts: preview.counts };
  } finally {
    live.close();
  }
}
