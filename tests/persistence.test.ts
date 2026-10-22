import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { migrateTestDatabase } from "../scripts/migrate-test-db";
test("real SQLite CRUD, partial status updates, action history, import policy, restart persistence and cascade deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "internshiphq-test-"));
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  const sqlite = new Database(join(dir, "test.db"));
  migrateTestDatabase(sqlite);
  sqlite.close();
  const { db } = await import("../src/lib/db");
  const {
    createApplication,
    updateApplication,
    completeAction,
    listApplications,
  } = await import("../src/lib/applications");
  const { exportCSV, parseCSV, autoMapping } = await import("../src/lib/csv");
  const { runImport } = await import("../src/lib/importer");
  try {
    const created = await createApplication({
      company: "Fictional Test",
      position: "Intern",
      notes: "Keep these notes",
      deadline: "2027-02-28",
      nextAction: "Tailor resume",
      nextActionDue: "2026-10-20",
    });
    assert.equal(created.activities[0].type, "created");
    await assert.rejects(
      createApplication({ company: "Fictional Test", position: "Intern" }),
      /similar application/,
    );
    const changed = await updateApplication(created.id, {
      status: "Interview",
    });
    assert.equal(changed.status, "Interview");
    assert.equal(changed.notes, "Keep these notes");
    assert.equal(changed.deadline, "2027-02-28");
    assert.ok(
      changed.activities.some(
        (a) => a.message === "Status changed from Saved to Interview",
      ),
    );
    const completed = await completeAction(created.id, {
      nextAction: "Prepare questions",
      nextActionDue: "2026-10-23",
    });
    assert.equal(completed.nextAction, "Prepare questions");
    assert.ok(
      completed.activities.some((a) =>
        a.message.includes("Completed: Tailor resume"),
      ),
    );
    const cleared = await completeAction(created.id, {
      nextAction: "",
      nextActionDue: "",
    });
    assert.equal(cleared.nextAction, "");
    await assert.rejects(
      completeAction(created.id, {}),
      /already been completed/,
    );
    // Read from a fresh process: no client memory can supply the saved data.
    const readBack = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import Database from 'better-sqlite3';const d=new Database(process.env.DATABASE_URL.slice(5));console.log(JSON.stringify(d.prepare('SELECT company,status,notes,deadline FROM Application').all()));d.close();",
      ],
      { encoding: "utf8", env: process.env },
    );
    assert.deepEqual(JSON.parse(readBack), [
      {
        company: "Fictional Test",
        status: "Interview",
        notes: "Keep these notes",
        deadline: "2027-02-28",
      },
    ]);
    const csv = exportCSV(JSON.parse(JSON.stringify(await listApplications())));
    const mapping = autoMapping(parseCSV(csv).headers);
    assert.equal((await runImport(csv, mapping)).accepted, 0);
    assert.equal((await runImport(csv, mapping, true)).accepted, 1);
    assert.equal((await listApplications()).length, 2);
    await db.application.deleteMany();
    assert.equal(await db.activity.count(), 0);
    assert.equal((await runImport(csv, mapping)).accepted, 1);
    const restored = (await listApplications())[0];
    assert.equal(restored.id, created.id);
    assert.equal(
      restored.createdAt.toISOString(),
      created.createdAt.toISOString(),
    );
    assert.equal(
      restored.updatedAt.toISOString(),
      cleared.updatedAt.toISOString(),
    );
    assert.equal(restored.notes, "Keep these notes");
    assert.equal(restored.activities.length, cleared.activities.length + 1);
    await db.application.delete({ where: { id: restored.id } });
    assert.equal((await listApplications()).length, 0);
    assert.equal(await db.activity.count(), 0);
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
