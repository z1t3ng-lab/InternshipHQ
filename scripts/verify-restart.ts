import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { migrateTestDatabase } from "./migrate-test-db";

const directory = mkdtempSync(join(tmpdir(), "internshiphq-restart-"));
const databasePath = join(directory, "restart.db");
const sqlite = new Database(databasePath);
migrateTestDatabase(sqlite);
sqlite.close();
let server: ChildProcess | undefined;
const url = "http://127.0.0.1:3102";
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3102",
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Test server did not start")),
      15000,
    );
    server!.stdout!.on("data", (chunk) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server!.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Test server exited: ${code}`));
    });
    server!.stderr!.on("data", (chunk) => process.stderr.write(chunk));
  });
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  await exited;
  server = undefined;
}
try {
  await start();
  const response = await fetch(`${url}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({
      data: {
        company: "Fictional Restart Test",
        position: "Engineering Intern",
        deadline: "2027-01-12",
        notes: "Must survive a full server restart",
      },
    }),
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  await stop();
  await start();
  const rows = await (await fetch(`${url}/api/applications`)).json();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], created);
  const blocked = await fetch(`${url}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ data: { company: "Blocked", position: "Intern" } }),
  });
  assert.equal(blocked.status, 403);
  console.log(
    "PASS: complete application and history survived a full Next.js server restart; cross-origin writes rejected.",
  );
} finally {
  await stop();
  rmSync(directory, { recursive: true, force: true });
}
