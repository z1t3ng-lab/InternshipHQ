import test from "node:test";
import assert from "node:assert/strict";
import {
  autoMapping,
  exportCSV,
  parseCSV,
  previewImport,
  safeCell,
} from "../src/lib/csv";
import { EMPTY_APPLICATION, type ApplicationRecord } from "../src/lib/domain";
const record: ApplicationRecord = {
  ...EMPTY_APPLICATION,
  id: "test-1",
  company: 'Érable, "Fictional"',
  position: "Intern",
  notes: "Line one\nLine two, avec accents",
  createdAt: "2026-10-21T16:00:00.000Z",
  updatedAt: "2026-10-21T18:00:00.000Z",
  activities: [
    {
      type: "status",
      message: "Saved → Preparing",
      createdAt: "2026-10-21T18:00:00.000Z",
    },
  ],
};
test("CSV round trip preserves every editable field, quotes, newlines, timestamps, ID, and history", () => {
  const source = {
    ...record,
    jobUrl: "https://example.com/a?b=1&c=2",
    location: "Montréal",
    arrangement: "Hybrid" as const,
    term: "Summer 2027",
    deadline: "2027-01-20",
    dateApplied: "2026-10-20",
    status: "Assessment" as const,
    priority: "High" as const,
    nextAction: "=Potential formula",
    nextActionDue: "2026-10-28",
    contactName: "Anne",
    contactEmail: "anne@example.com",
    resume: "'resume.csv",
    coverLetter: "+cover.docx",
    sourceEmailUrl: "https://mail.google.com/mail/u/0/#inbox/example",
  };
  const parsed = parseCSV(exportCSV([source]));
  assert.deepEqual(parsed.errors, []);
  const [row] = previewImport(parsed, autoMapping(parsed.headers), []);
  assert.deepEqual(row.errors, []);
  for (const key of Object.keys(EMPTY_APPLICATION))
    assert.equal(
      row.data![key as keyof typeof EMPTY_APPLICATION],
      source[key as keyof typeof EMPTY_APPLICATION],
      key,
    );
  assert.equal(row.id, source.id);
  assert.equal(row.createdAt, source.createdAt);
  assert.equal(row.updatedAt, source.updatedAt);
  assert.deepEqual(row.history, source.activities);
});
test("spreadsheet formula injection is escaped including whitespace and apostrophes", () => {
  for (const value of [
    "=SUM(A1)",
    "+cmd",
    "-danger",
    "@danger",
    "\t=cmd",
    "\r=cmd",
    "  =cmd",
    "'hello",
  ])
    assert.equal(safeCell(value), `'${value}`);
  assert.equal(safeCell("Ordinary text"), "Ordinary text");
});
test("malformed quoted CSV is blocked; invalid rows, dates, unknown status and missing fields explained", () => {
  assert.ok(parseCSV('company,position\n"unfinished,Intern').errors.length);
  const parsed = parseCSV(
    "company,position,deadline,status\nA,Intern,2027-02-30,Saved\nB,Intern,,Unknown\n,Intern,,Saved\nC,Intern,,Applied,extra\nD,Intern,,Saved",
  );
  const rows = previewImport(parsed, autoMapping(parsed.headers), []);
  assert.deepEqual(
    rows.map((r) => r.errors.length > 0),
    [true, true, true, true, false],
  );
  assert.equal(parseCSV("company,company\nA,B").errors.length, 1);
});
test("duplicates within file and in database are flagged, and blank optional fields stay blank", () => {
  const p = parseCSV(
    "Company Name,Role\nAcme,Intern\nAcme,Intern\nAcme,Designer",
  );
  const rows = previewImport(p, autoMapping(p.headers), []);
  assert.deepEqual(
    rows.map((r) => r.duplicate),
    [false, true, false],
  );
  assert.equal(rows[0].data!.dateApplied, "");
  const exported = parseCSV(exportCSV([record]));
  assert.equal(
    previewImport(exported, autoMapping(exported.headers), [record])[0]
      .duplicate,
    true,
  );
});
