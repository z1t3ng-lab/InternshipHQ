import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const source = resolve(
  (process.env.DATABASE_URL || "file:./prisma/internshiphq.db").replace(
    /^file:/,
    "",
  ),
);
mkdirSync("backups", { recursive: true });
const output = resolve(
  `backups/internshiphq-${new Date().toISOString().replace(/[:.]/g, "-")}.db`,
);
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(output);
  console.log(`Consistent SQLite backup saved to ${output}`);
} finally {
  db.close();
}
