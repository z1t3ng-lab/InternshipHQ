import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { migrateTestDatabase } from "../scripts/migrate-test-db";

test("immutable document versions, selection validation, archival, CSV references and full SQLite backup", async () => {
  const folder = mkdtempSync(join(tmpdir(), "internshiphq-documents-"));
  const path = join(folder, "documents.db");
  process.env.DATABASE_URL = `file:${path}`;
  const sqlite = new Database(path);
  migrateTestDatabase(sqlite);
  sqlite.close();
  const { db } = await import("../src/lib/db");
  const { uploadDocument, listDocuments } =
    await import("../src/lib/documents");
  const { createApplication, updateApplication, listApplications } =
    await import("../src/lib/applications");
  const { exportCSV, parseCSV, autoMapping } = await import("../src/lib/csv");
  const { runImport } = await import("../src/lib/importer");
  const pdf = (version: string) =>
    new File([`%PDF-1.7\nFictional test ${version}\n%%EOF`], "cv.pdf", {
      type: "application/pdf",
    });
  try {
    const v1 = await uploadDocument(
      { name: "Engineering", version: "v1", kind: "CV" },
      pdf("v1"),
    );
    const v2 = await uploadDocument(
      { name: "Engineering", version: "v2", kind: "CV" },
      pdf("v2"),
    );
    const letter = await uploadDocument(
      { name: "Research", version: "October", kind: "Motivation letter" },
      pdf("letter"),
    );
    const transcript = await uploadDocument(
      { name: "Grades", version: "Fall", kind: "Transcript" },
      pdf("grades"),
    );
    assert.notEqual(v1.id, v2.id);
    assert.notEqual(v1.sha256, v2.sha256);
    assert.equal("content" in (await listDocuments())[0], false);
    await assert.rejects(
      uploadDocument(
        { name: "Fake", version: "v1", kind: "CV" },
        new File(["<script>bad</script>"], "fake.pdf"),
      ),
      /must be a PDF/,
    );
    await assert.rejects(
      uploadDocument(
        { name: "Empty", version: "v1", kind: "CV" },
        new File([], "empty.pdf"),
      ),
      /nonempty/,
    );
    await assert.rejects(
      uploadDocument(
        { name: "Large", version: "v1", kind: "CV" },
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf"),
      ),
      /10 MB/,
    );
    const app = await createApplication({
      company: "Fictional Documents",
      position: "Intern",
      resumeDocumentId: v1.id,
      letterDocumentId: letter.id,
      transcriptDocumentId: transcript.id,
    });
    assert.match(app.resume, /Engineering · v1/);
    assert.match(app.coverLetter, /Research · October/);
    assert.match(app.transcript, /Grades · Fall/);
    await assert.rejects(
      createApplication({
        company: "Wrong kind",
        position: "Intern",
        resumeDocumentId: transcript.id,
      }),
      /available/,
    );
    await assert.rejects(
      updateApplication(app.id, { resumeDocumentId: "nonexistent" }),
      /available/,
    );
    await db.document.update({
      where: { id: v1.id },
      data: { archived: true },
    });
    const changed = await updateApplication(app.id, { status: "Applied" });
    assert.equal(changed.resumeDocumentId, v1.id);
    assert.equal(changed.resume, app.resume);
    await assert.rejects(
      createApplication({
        company: "Archived",
        position: "Intern",
        resumeDocumentId: v1.id,
      }),
      /Restore/,
    );
    const csv = exportCSV(JSON.parse(JSON.stringify(await listApplications())));
    const mapping = autoMapping(parseCSV(csv).headers);
    await db.application.deleteMany();
    await runImport(csv, mapping);
    assert.equal((await listApplications())[0].resumeDocumentId, v1.id);
    const bytes = (
      await db.document.findUniqueOrThrow({ where: { id: v1.id } })
    ).content;
    assert.deepEqual(
      Buffer.from(bytes),
      Buffer.from(await pdf("v1").arrayBuffer()),
    );
    const reader = new Database(path, { readonly: true });
    await reader.backup(join(folder, "backup.db"));
    reader.close();
    const backup = new Database(join(folder, "backup.db"), { readonly: true });
    assert.equal(
      (
        backup.prepare("SELECT COUNT(*) AS n FROM Document").get() as {
          n: number;
        }
      ).n,
      4,
    );
    assert.deepEqual(
      (
        backup
          .prepare("SELECT content FROM Document WHERE id = ?")
          .get(v1.id) as { content: Buffer }
      ).content,
      Buffer.from(bytes),
    );
    backup.close();
    await db.application.deleteMany();
    await db.document.deleteMany();
    await runImport(csv, mapping);
    const restored = (await listApplications())[0];
    assert.equal(restored.resumeDocumentId, "");
    assert.equal(restored.resume, app.resume);
    assert.equal(restored.transcriptDocumentId, "");
    assert.equal(restored.transcript, app.transcript);
  } finally {
    await db.$disconnect();
    rmSync(folder, { recursive: true, force: true });
  }
});
