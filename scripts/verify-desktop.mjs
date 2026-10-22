import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const folder = mkdtempSync(join(tmpdir(), "internshiphq-desktop-"));
let child;
async function start() {
  child = spawn(process.execPath, ["desktop/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: `file:${join(folder, "personal.db")}`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let log = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Desktop server did not start:\n${log}`)),
      120000,
    );
    child.stderr.on("data", (chunk) => {
      log += chunk;
    });
    child.stdout.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/INTERNSHIPHQ_READY (\{[^\n]+\})/);
      if (match) {
        clearTimeout(timer);
        resolve(JSON.parse(match[1]).url);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Desktop server exited ${code}:\n${log}`));
    });
  });
}
async function stop(usePipe = false) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, "exit");
  if (usePipe) child.stdin.end();
  else child.kill("SIGTERM");
  await exited;
}
try {
  const url = await start();
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal((await fetch(url)).status, 200);
  const content = "%PDF-1.7\nFictional desktop document\n%%EOF";
  const form = new FormData();
  form.set("name", "Fictional desktop CV");
  form.set("version", "v1");
  form.set("kind", "CV");
  form.set("file", new File([content], "cv.pdf", { type: "application/pdf" }));
  const upload = await fetch(`${url}/api/documents`, {
    method: "POST",
    headers: { Origin: url },
    body: form,
  });
  assert.equal(upload.status, 201);
  const document = await upload.json();
  let response = await fetch(`${url}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({
      data: {
        company: "Fictional Desktop Test",
        position: "Intern",
        notes: "Persist through desktop restarts",
        resumeDocumentId: document.id,
      },
    }),
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  response = await fetch(`${url}/api/export`);
  assert.ok((await response.text()).includes("Fictional Desktop Test"));
  await stop(true); // Closing the native app's pipe must stop its server.
  await assert.rejects(fetch(url));
  const reopened = await start();
  const records = await (await fetch(`${reopened}/api/applications`)).json();
  assert.deepEqual(records[0], created);
  assert.equal(records.length, 1);
  assert.equal(records[0].resumeDocumentId, document.id);
  assert.equal(
    await (await fetch(`${reopened}/api/documents/${document.id}`)).text(),
    content,
  );
  console.log(
    "PASS: automatic initialization, dynamic localhost port, same-origin saves, CSV export, shutdown on app exit, and application/document persistence after reopening.",
  );
} finally {
  await stop();
  rmSync(folder, { recursive: true, force: true });
}
