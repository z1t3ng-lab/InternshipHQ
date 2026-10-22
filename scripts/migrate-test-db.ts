import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

export function migrateTestDatabase(db: Database.Database) {
  const root = "prisma/migrations";
  for (const entry of readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name)))
    db.exec(readFileSync(join(root, entry.name, "migration.sql"), "utf8"));
}
