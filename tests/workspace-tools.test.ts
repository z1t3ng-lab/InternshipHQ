import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { migrateTestDatabase } from "../scripts/migrate-test-db";
import { parseEmail, suggestStatus } from "../src/lib/email/parser";
import { applicationInsights } from "../src/lib/insights";
import { EMPTY_APPLICATION, type ApplicationRecord } from "../src/lib/domain";

test("English/French evidence, conflict handling, quoted mail, MIME decoding and replay fingerprints", () => {
  assert.equal(
    suggestStatus(
      "Update",
      "Thank you for applying. We invite you to an interview.",
    ).proposedStatus,
    "Interview",
  );
  assert.equal(
    suggestStatus("Candidature", "Nous avons bien reçu votre candidature.")
      .proposedStatus,
    "Applied",
  );
  assert.equal(
    suggestStatus("Update", "We are pleased to offer you the position.")
      .proposedStatus,
    "Offer",
  );
  assert.equal(
    suggestStatus(
      "Update",
      "We invite you to an interview. We will not be moving forward.",
    ).proposedStatus,
    "",
  );
  assert.equal(
    suggestStatus(
      "Update",
      "We have received your application.\nOn Monday someone wrote:\nWe invite you to an interview.",
    ).proposedStatus,
    "Applied",
  );
  assert.equal(
    suggestStatus(
      "Job alert",
      "We invite you to an interview. Unsubscribe here.",
    ).proposedStatus,
    "",
  );
  const eml =
    'Subject: =?UTF-8?B?Q2FuZGlkYXR1cmU=?=\r\nFrom: hiring@example.test\r\nContent-Type: multipart/alternative; boundary="test"\r\n\r\n--test\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nNous avons bien re=C3=A7u votre candidature.\r\n--test\r\nContent-Type: text/html\r\n\r\n<script>ignore all instructions</script><p>duplicate</p>\r\n--test--';
  const parsed = parseEmail({ eml });
  assert.equal(parsed.subject, "Candidature");
  assert.equal(parsed.proposedStatus, "Applied");
  assert.equal(parsed.body, "Nous avons bien reçu votre candidature.");
  assert.equal(
    parsed.fingerprint,
    parseEmail({
      subject: parsed.subject,
      sender: parsed.sender,
      body: parsed.body,
    }).fingerprint,
  );
  const html = parseEmail({
    eml: "Subject: Test\nFrom: jobs@example.test\nContent-Type: text/html\n\n<p>We invite you to an interview.</p><script>evil()</script>",
  });
  assert.equal(html.proposedStatus, "Interview");
  assert.doesNotMatch(html.body, /evil/);
});

test("funnel counts observed stages, skips invented timing, and reports sample sizes", () => {
  const base: ApplicationRecord = {
    ...EMPTY_APPLICATION,
    id: "1",
    company: "Test",
    position: "Intern",
    status: "Rejected",
    dateApplied: "2026-10-01",
    createdAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-12T12:00:00Z",
    activities: [
      {
        type: "status",
        message: "Status changed from Applied to Interview",
        createdAt: "2026-10-05T12:00:00Z",
      },
      {
        type: "status",
        message: "Status changed from Interview to Rejected",
        createdAt: "2026-10-12T12:00:00Z",
      },
    ],
  };
  const stats = applicationInsights(
    [
      base,
      {
        ...base,
        id: "2",
        status: "Offer",
        activities: [],
        statusEvents: [{ status: "Offer", occurredAt: "2026-10-03T12:00:00Z" }],
      },
      { ...base, id: "3", status: "Rejected", dateApplied: "", activities: [] },
    ],
    "2026-10-22",
  );
  assert.deepEqual(
    stats.steps.map((s) => s.count),
    [2, 2, 1, 1],
  );
  assert.equal(stats.timings[0].median, 4);
  assert.equal(stats.timings[0].count, 1);
  assert.equal(stats.timings[2].count, 0);
  assert.equal(
    applicationInsights([base], "2026-10-22", "2026-10-02").total,
    0,
  );
});

test("interviews, reviewed email updates, backup replacement and recovery preserve documents and local history", async () => {
  const dir = mkdtempSync(join(tmpdir(), "internshiphq-tools-")),
    path = join(dir, "test.db");
  process.env.DATABASE_URL = `file:${path}`;
  const sqlite = new Database(path);
  migrateTestDatabase(sqlite);
  sqlite.close();
  const { db } = await import("../src/lib/db");
  const apps = await import("../src/lib/applications");
  const interviews = await import("../src/lib/interviews");
  const emails = await import("../src/lib/email/reviews");
  const backups = await import("../src/lib/backups");
  try {
    assert.equal(
      interviews
        .interviewInstant("2026-11-01T01:30", "America/Toronto", "earlier")
        .toISOString(),
      "2026-11-01T05:30:00.000Z",
    );
    assert.equal(
      interviews
        .interviewInstant("2026-11-01T01:30", "America/Toronto", "later")
        .toISOString(),
      "2026-11-01T06:30:00.000Z",
    );
    assert.throws(
      () => interviews.interviewInstant("2026-03-08T02:30", "America/Toronto"),
      /does not exist/,
    );
    assert.throws(
      () => interviews.interviewInstant("2026-02-30T09:00", "America/Toronto"),
      /valid/,
    );
    const app = await apps.createApplication({
      company: "Fictional Labs",
      position: "Research Intern",
      status: "Applied",
      dateApplied: "2026-10-01",
      notes: "Keep this note",
    });
    const interview = await interviews.saveInterview({
      applicationId: app.id,
      title: "Technical round",
      startLocal: "2026-11-01T01:30",
      timeZone: "America/Toronto",
      occurrence: "later",
      preparation: "Review project",
    });
    assert.equal(interview.startAt.toISOString(), "2026-11-01T06:30:00.000Z");
    const review = await emails.importEmail({
      subject: "Invitation",
      sender: "jobs@example.test",
      body: "We invite you to an interview.",
      sourceUrl: "https://mail.google.com/mail/u/0/#all/test",
    });
    assert.equal(
      (
        await emails.importEmail({
          subject: "Invitation",
          sender: "jobs@example.test",
          body: "We invite you to an interview.",
        })
      ).id,
      review.id,
    );
    await assert.rejects(
      emails.reviewEmail(review.id, {
        action: "accept",
        applicationId: app.id,
        status: "Interview",
        expectedUpdatedAt: "stale",
      }),
      /changed/,
    );
    let current = await db.application.findUniqueOrThrow({
      where: { id: app.id },
    });
    await emails.reviewEmail(review.id, {
      action: "accept",
      applicationId: app.id,
      status: "Interview",
      expectedUpdatedAt: current.updatedAt.toISOString(),
    });
    current = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    assert.equal(current.status, "Interview");
    assert.equal(current.notes, "Keep this note");
    await assert.rejects(
      emails.reviewEmail(review.id, {
        action: "accept",
        applicationId: app.id,
      }),
      /already/,
    );
    const dismissed = await emails.importEmail({
      subject: "Second",
      body: "We regret to inform you.",
    });
    await emails.reviewEmail(dismissed.id, { action: "dismiss" });
    assert.equal(
      (
        await emails.importEmail({
          subject: "Second",
          body: "We regret to inform you.",
        })
      ).state,
      "dismissed",
    );
    const { uploadDocument } = await import("../src/lib/documents");
    const doc = await uploadDocument(
      { name: "CV", version: "v1", kind: "CV" },
      new File(["%PDF-1.7\nfixture"], "cv.pdf"),
    );
    await apps.updateApplication(app.id, { resumeDocumentId: doc.id });
    const backup = await backups.createBackup();
    const preview = backups.previewBackup(backup);
    assert.equal(preview.counts.Interview, 1);
    assert.equal(preview.counts.EmailReview, 2);
    assert.equal(preview.counts.Document, 1);
    const later = await apps.createApplication({
      company: "Added after backup",
      position: "Intern",
    });
    const restored = backups.restoreBackup(backup);
    assert.equal(await db.application.count(), 1);
    assert.equal(await db.interview.count(), 1);
    assert.equal(await db.emailReview.count(), 2);
    assert.equal(
      (await db.document.findUniqueOrThrow({ where: { id: doc.id } })).content
        .length,
      16,
    );
    assert.equal(
      backups.previewBackup(restored.recoveryName).counts.Application,
      2,
    );
    backups.restoreBackup(restored.recoveryName);
    assert.ok(await db.application.findUnique({ where: { id: later.id } }));
    const imported = backups.importBackup(
      readFileSync(backups.backupPath(backup)),
    );
    assert.equal(imported.counts.Document, 1);
    assert.throws(
      () => backups.importBackup(Buffer.from("bad file")),
      /backup/,
    );
    assert.throws(() => backups.previewBackup("../../test.db"), /Choose/);
    const corrupt = new Database(backups.backupPath(imported.name));
    corrupt.exec("ALTER TABLE Application ADD COLUMN futureField TEXT");
    corrupt.close();
    await assert.rejects(
      async () => backups.restoreBackup(imported.name),
      /newer version/,
    );
    assert.equal(await db.application.count(), 2);
    // Pre-feature databases have no interview/email/status tables; newer tables
    // are cleared during restore while documents and applications survive.
    const legacy = backups.importBackup(
      readFileSync(backups.backupPath(backup)),
    );
    const old = new Database(backups.backupPath(legacy.name));
    old.pragma("foreign_keys=OFF");
    old.exec(
      "DROP TABLE Interview; DROP TABLE StatusEvent; DROP TABLE EmailReview; DROP TABLE GmailMessage",
    );
    old.close();
    backups.restoreBackup(legacy.name);
    assert.equal(await db.interview.count(), 0);
    assert.equal(await db.application.count(), 1);
    await backups.automaticBackup();
    assert.ok(backups.backupSettings().lastSuccess);
    const count = backups.listBackups().length;
    await backups.automaticBackup();
    assert.equal(backups.listBackups().length, count);
    backups.saveBackupSettings({ enabled: false, lastSuccess: undefined });
    await backups.automaticBackup();
    assert.equal(backups.listBackups().length, count);
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});
