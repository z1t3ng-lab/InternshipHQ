import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
// Prisma migrate deploy expects an existing SQLite file on some engine versions.
// Opening the file creates it without touching any existing tables or records.
const url = process.env.DATABASE_URL || "file:./prisma/internshiphq.db";
if (!url.startsWith("file:"))
  throw new Error("InternshipHQ requires a local SQLite file URL.");
const path = resolve(url.slice(5));
mkdirSync(dirname(path), { recursive: true });
new Database(path).close();
