import { z } from "zod";

export const STATUSES = [
  "Saved",
  "Preparing",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const ARRANGEMENTS = [
  "Unspecified",
  "Remote",
  "Hybrid",
  "On-site",
] as const;
export const TIMEZONE = "America/Toronto";
export const TERMINAL = new Set<string>(["Offer", "Rejected", "Withdrawn"]);
export type Status = (typeof STATUSES)[number];

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const text = z
  .string()
  .max(10000, "Use 10,000 characters or fewer.")
  .default("");
const date = z
  .string()
  .refine((v) => !v || validDate(v), "Use a valid date in YYYY-MM-DD format.")
  .default("");
const url = z
  .string()
  .refine((v) => {
    if (!v) return true;
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Enter a full http:// or https:// URL.")
  .default("");
export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  position: z.string().trim().min(1, "Position is required.").max(300),
  jobUrl: url,
  location: text,
  arrangement: z.enum(ARRANGEMENTS).default("Unspecified"),
  term: text,
  deadline: date,
  dateApplied: date,
  status: z.enum(STATUSES).default("Saved"),
  priority: z.enum(PRIORITIES).default("Medium"),
  nextAction: text,
  nextActionDue: date,
  contactName: text,
  contactEmail: z
    .string()
    .refine(
      (v) => !v || z.email().safeParse(v).success,
      "Enter a valid email address.",
    )
    .default(""),
  resume: text,
  coverLetter: text,
  transcript: text,
  resumeDocumentId: z.string().max(100).default(""),
  letterDocumentId: z.string().max(100).default(""),
  transcriptDocumentId: z.string().max(100).default(""),
  notes: text,
  sourceEmailUrl: url,
});
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type Activity = {
  id?: string;
  type: string;
  message: string;
  createdAt: string;
};
export type ApplicationRecord = ApplicationInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
  statusEvents?: { status: string; occurredAt: string }[];
};
export const EMPTY_APPLICATION: ApplicationInput = {
  ...applicationSchema.parse({
    company: "Placeholder",
    position: "Placeholder",
  }),
  company: "",
  position: "",
};
export const FIELD_LABELS: Record<keyof ApplicationInput, string> = {
  company: "Company",
  position: "Position",
  jobUrl: "Job posting URL",
  location: "Location",
  arrangement: "Work arrangement",
  term: "Internship term",
  deadline: "Application deadline",
  dateApplied: "Date applied",
  status: "Status",
  priority: "Priority",
  nextAction: "Next action",
  nextActionDue: "Next action due",
  contactName: "Contact name",
  contactEmail: "Contact email",
  resume: "Resume version / filename",
  coverLetter: "Cover letter version / filename",
  transcript: "Transcript version / filename",
  resumeDocumentId: "CV document ID",
  letterDocumentId: "Letter document ID",
  transcriptDocumentId: "Transcript document ID",
  notes: "Notes",
  sourceEmailUrl: "Source email URL",
};
export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((i) => [i.path.join("."), i.message]),
  );
}
export function todayInToronto(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, count: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function formatDate(day: string, long = false) {
  if (!day || !validDate(day)) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    ...(long ? ({ year: "numeric" } as const) : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
export function metrics(records: ApplicationRecord[]) {
  return {
    total: records.length,
    active: records.filter((a) => !TERMINAL.has(a.status)).length,
    submitted: records.filter((a) => !!a.dateApplied).length,
    interview: records.filter((a) => a.status === "Interview").length,
    offer: records.filter((a) => a.status === "Offer").length,
    statuses: Object.fromEntries(
      STATUSES.map((s) => [s, records.filter((a) => a.status === s).length]),
    ) as Record<Status, number>,
  };
}
export type Task = {
  application: ApplicationRecord;
  kind: "action" | "deadline";
  day: string;
  group: "Overdue" | "Today" | "Next 7 days";
  title: string;
};
export function tasksFor(records: ApplicationRecord[], today: string): Task[] {
  const end = addDays(today, 7);
  const result: Task[] = [];
  for (const a of records) {
    if (TERMINAL.has(a.status)) continue;
    const add = (day: string, kind: Task["kind"], title: string) => {
      if (day && day <= end)
        result.push({
          application: a,
          day,
          kind,
          title,
          group:
            day < today ? "Overdue" : day === today ? "Today" : "Next 7 days",
        });
    };
    if (a.nextAction) add(a.nextActionDue, "action", a.nextAction);
    if (["Saved", "Preparing"].includes(a.status))
      add(a.deadline, "deadline", "Submit application");
  }
  return result.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      a.application.company.localeCompare(b.application.company),
  );
}
export type Filters = {
  search: string;
  status: string;
  priority: string;
  term: string;
  arrangement: string;
  sort: string;
  direction: "asc" | "desc";
};
export const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "",
  priority: "",
  term: "",
  arrangement: "",
  sort: "updatedAt",
  direction: "desc",
};
export function filterApplications(
  records: ApplicationRecord[],
  filters: Filters,
) {
  const needle = filters.search.toLocaleLowerCase().trim();
  return records
    .filter(
      (a) =>
        (!needle ||
          [a.company, a.position, a.location, a.notes].some((v) =>
            v.toLocaleLowerCase().includes(needle),
          )) &&
        (!filters.status || a.status === filters.status) &&
        (!filters.priority || a.priority === filters.priority) &&
        (!filters.term || a.term === filters.term) &&
        (!filters.arrangement || a.arrangement === filters.arrangement),
    )
    .sort((a, b) => {
      const key = filters.sort as keyof ApplicationInput | "updatedAt";
      const av = a[key] || "",
        bv = b[key] || "";
      if (!av || !bv) return av ? -1 : bv ? 1 : a.id.localeCompare(b.id);
      return (
        av.localeCompare(bv, undefined, { sensitivity: "base" }) *
          (filters.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id)
      );
    });
}
function normalizedUrl(value: string) {
  try {
    const u = new URL(value);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
export function isDuplicate(
  a: Pick<ApplicationInput, "company" | "position" | "jobUrl">,
  b: Pick<ApplicationInput, "company" | "position" | "jobUrl">,
) {
  const norm = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return (
    (norm(a.company) === norm(b.company) &&
      norm(a.position) === norm(b.position)) ||
    (!!a.jobUrl &&
      !!b.jobUrl &&
      normalizedUrl(a.jobUrl) === normalizedUrl(b.jobUrl))
  );
}
