import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
const dir = mkdtempSync(join(tmpdir(), "internshiphq-browser-"));
const path = join(dir, "test.db");
const db = new Database(path);
db.exec(
  readFileSync("prisma/migrations/202610210001_init/migration.sql", "utf8"),
);
db.close();
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { stdio: "inherit", env: { ...process.env, DATABASE_URL: `file:${path}` } },
);
const stop = () => child.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
