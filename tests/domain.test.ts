import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applicationSchema,
  DEFAULT_FILTERS,
  EMPTY_APPLICATION,
  filterApplications,
  formatDate,
  isDuplicate,
  metrics,
  tasksFor,
  todayInToronto,
  validDate,
  type ApplicationRecord,
} from "../src/lib/domain";
const record = (patch: Partial<ApplicationRecord> = {}): ApplicationRecord => ({
  ...EMPTY_APPLICATION,
  company: "Example",
  position: "Intern",
  id: "a",
  createdAt: "2026-10-21T16:00:00.000Z",
  updatedAt: "2026-10-21T16:00:00.000Z",
  activities: [],
  ...patch,
});
test("validates calendar dates, URLs, emails, and required fields without guessing", () => {
  assert.equal(validDate("2027-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2027-13-01"), false);
  assert.equal(validDate("2027-2-3"), false);
  assert.equal(validDate("0000-01-01"), false);
  assert.equal(
    applicationSchema.safeParse({ company: " ", position: "Intern" }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({
      company: "A",
      position: "B",
      jobUrl: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    applicationSchema.safeParse({
      company: "A",
      position: "B",
      contactEmail: "bad@",
    }).success,
    false,
  );
  const parsed = applicationSchema.parse({ company: "A", position: "B" });
  assert.equal(parsed.deadline, "");
  assert.equal(parsed.dateApplied, "");
});
test("Toronto today handles midnight and daylight saving; calendar dates never shift", () => {
  assert.equal(todayInToronto(new Date("2026-10-21T02:00:00Z")), "2026-10-20");
  assert.equal(todayInToronto(new Date("2026-01-01T04:59:00Z")), "2025-12-31");
  assert.equal(todayInToronto(new Date("2026-03-08T07:01:00Z")), "2026-03-08");
  assert.equal(addDays("2026-03-07", 2), "2026-03-09");
  const original = process.env.TZ;
  for (const zone of [
    "Pacific/Honolulu",
    "Asia/Tokyo",
    "America/Toronto",
    "UTC",
  ]) {
    process.env.TZ = zone;
    assert.equal(formatDate("2027-01-01"), "Jan 1");
  }
  process.env.TZ = original;
});
test("metrics use stored applied dates and documented terminal statuses", () => {
  const m = metrics([
    record(),
    record({ id: "b", status: "Applied" }),
    record({ id: "c", status: "Interview", dateApplied: "2026-10-01" }),
    record({ id: "d", status: "Offer", dateApplied: "2026-10-02" }),
    record({ id: "e", status: "Rejected" }),
    record({ id: "f", status: "Withdrawn" }),
  ]);
  assert.deepEqual(
    [m.total, m.active, m.submitted, m.interview, m.offer],
    [6, 3, 2, 1, 1],
  );
  assert.equal(
    Object.values(m.statuses).reduce((a, b) => a + b, 0),
    6,
  );
});
test("today lists overdue, today, next seven days, and saved/preparing deadlines only", () => {
  const items = [
    record({
      nextAction: "Fix resume",
      nextActionDue: "2026-10-20",
      deadline: "2026-10-28",
    }),
    record({
      id: "b",
      nextAction: "Research",
      nextActionDue: "2026-10-21",
      status: "Applied",
      deadline: "2026-10-22",
    }),
    record({ id: "c", nextAction: "Later", nextActionDue: "2026-10-29" }),
    ...["Offer", "Rejected", "Withdrawn"].map((status, i) =>
      record({
        id: `${i}`,
        status: status as ApplicationRecord["status"],
        nextAction: "Old action",
        nextActionDue: "2026-01-01",
      }),
    ),
    record({ id: "undated", nextAction: "No date" }),
  ];
  const tasks = tasksFor(items, "2026-10-21");
  assert.equal(tasks.length, 3);
  assert.deepEqual(
    tasks.map((t) => t.group),
    ["Overdue", "Today", "Next 7 days"],
  );
  assert.equal(tasks.filter((t) => t.kind === "deadline").length, 1);
});
test("search, combined filters, and sorting work together; blanks sort last", () => {
  const rows = [
    record({
      company: "Cedar",
      location: "Toronto",
      priority: "High",
      term: "Summer 2027",
      arrangement: "Remote",
      deadline: "2027-01-02",
    }),
    record({
      id: "b",
      company: "Birch",
      notes: "Toronto office",
      priority: "High",
      term: "Summer 2027",
      arrangement: "Remote",
      deadline: "2027-01-01",
    }),
    record({ id: "c", company: "Other", location: "Toronto", priority: "Low" }),
    record({
      id: "d",
      company: "Aspen",
      location: "Toronto",
      priority: "High",
      term: "Summer 2027",
      arrangement: "Remote",
    }),
  ];
  const filters = {
    ...DEFAULT_FILTERS,
    search: "TORONTO",
    priority: "High",
    term: "Summer 2027",
    arrangement: "Remote",
    status: "Saved",
    sort: "deadline",
    direction: "asc" as const,
  };
  assert.deepEqual(
    filterApplications(rows, filters).map((r) => r.company),
    ["Birch", "Cedar", "Aspen"],
  );
  assert.deepEqual(
    filterApplications(rows, { ...filters, direction: "desc" }).map(
      (r) => r.company,
    ),
    ["Cedar", "Birch", "Aspen"],
  );
});
test("duplicate detection uses role plus company or a matching posting, never company alone", () => {
  assert.equal(isDuplicate(record(), record({ company: " EXAMPLE " })), true);
  assert.equal(
    isDuplicate(record(), record({ position: "Different role" })),
    false,
  );
  assert.equal(
    isDuplicate(
      record({ jobUrl: "https://example.com/job/#details" }),
      record({ company: "Other", jobUrl: "https://example.com/job" }),
    ),
    true,
  );
});
