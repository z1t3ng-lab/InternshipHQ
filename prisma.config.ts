import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolve } from "node:path";
const url = process.env.DATABASE_URL || "file:./prisma/internshiphq.db";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: `file:${resolve(url.replace(/^file:/, ""))}` },
});
