import Papa from "papaparse";
import { z } from "zod";
import {
  applicationSchema,
  FIELD_LABELS,
  isDuplicate,
  type ApplicationInput,
  type ApplicationRecord,
  type Activity,
} from "./domain";

export const CSV_FIELDS = [
  ...Object.keys(FIELD_LABELS),
  "id",
  "createdAt",
  "updatedAt",
  "activityHistory",
  "formatVersion",
];
export const CSV_LABELS: Record<string, string> = {
  ...FIELD_LABELS,
  id: "Record ID",
  createdAt: "Created timestamp",
  updatedAt: "Updated timestamp",
  activityHistory: "Activity history (JSON)",
  formatVersion: "Export format version",
};
export type ColumnMapping = Record<string, string>;
export type ParsedCSV = {
  headers: string[];
  rows: string[][];
  errors: string[];
};
export type ImportRow = {
  row: number;
  data?: ApplicationInput;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: Activity[];
  errors: string[];
  duplicate: boolean;
  label: string;
};
export function parseCSV(csv: string): ParsedCSV {
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  const [headers = [], ...rows] = parsed.data;
  const errors = parsed.errors.map(
    (e) => `CSV row ${(e.row ?? 0) + 1}: ${e.message}`,
  );
  if (!headers.length) errors.push("The file is empty.");
  if (new Set(headers).size !== headers.length)
    errors.push(
      "Column names must be unique. Rename duplicate columns in your spreadsheet.",
    );
  if (rows.length > 2000) errors.push("Import up to 2,000 rows at a time.");
  return { headers, rows, errors };
}
export function autoMapping(headers: string[]): ColumnMapping {
  const aliases: Record<string, string[]> = {
    company: ["company name", "employer"],
    position: ["role", "position title", "job title"],
    jobUrl: ["url", "job link", "posting url"],
    nextActionDue: ["next action due date"],
    deadline: ["deadline"],
    term: ["term"],
    resume: ["resume"],
    coverLetter: ["cover letter"],
  };
  const norm = (s: string) => s.toLowerCase().replace(/[ _-]/g, "");
  return Object.fromEntries(
    CSV_FIELDS.map((field) => [
      field,
      headers.find((h) =>
        [field, CSV_LABELS[field], ...(aliases[field] || [])].some(
          (a) => norm(a) === norm(h),
        ),
      ) || "",
    ]),
  );
}
const historySchema = z
  .array(
    z.object({
      type: z.string().max(100),
      message: z.string().max(10000),
      createdAt: z.iso.datetime({ offset: true }),
    }),
  )
  .max(10000);
function decodeExport(value: string) {
  return value.startsWith("'") && /^[\s]*[=+\-@'\t\r\n]/.test(value.slice(1))
    ? value.slice(1)
    : value;
}
export function previewImport(
  parsed: ParsedCSV,
  mapping: ColumnMapping,
  existing: ApplicationRecord[],
): ImportRow[] {
  const seen: (ApplicationInput & { id?: string })[] = [...existing];
  return parsed.rows.map((row, index) => {
    const errors: string[] = [];
    if (row.length !== parsed.headers.length)
      errors.push(
        `Expected ${parsed.headers.length} columns, found ${row.length}.`,
      );
    const get = (field: string) => {
      const i = parsed.headers.indexOf(mapping[field]);
      return i < 0 ? "" : (row[i] ?? "");
    };
    const ownExport = get("formatVersion") === "internshiphq-v1";
    const raw = Object.fromEntries(
      Object.keys(FIELD_LABELS).map((k) => [
        k,
        ownExport ? decodeExport(get(k)) : get(k),
      ]),
    );
    for (const key of ["status", "priority", "arrangement"]) {
      if (!raw[key]) delete raw[key];
      else {
        const options =
          key === "status"
            ? [
                "Saved",
                "Preparing",
                "Applied",
                "Assessment",
                "Interview",
                "Offer",
                "Rejected",
                "Withdrawn",
              ]
            : key === "priority"
              ? ["Low", "Medium", "High"]
              : ["Unspecified", "Remote", "Hybrid", "On-site"];
        raw[key] =
          options.find(
            (s) => s.toLowerCase() === raw[key].trim().toLowerCase(),
          ) || raw[key];
      }
    }
    const result = applicationSchema.safeParse(raw);
    if (!result.success)
      errors.push(
        ...result.error.issues.map(
          (i) =>
            `${CSV_LABELS[String(i.path[0])] || String(i.path[0])}: ${i.message}`,
        ),
      );
    const id = get("id");
    if (id && !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      errors.push(
        "Record ID must contain only letters, numbers, hyphens, or underscores.",
      );
    for (const key of ["createdAt", "updatedAt"])
      if (
        get(key) &&
        !z.iso.datetime({ offset: true }).safeParse(get(key)).success
      )
        errors.push(
          `${CSV_LABELS[key]} must be an ISO timestamp with a timezone.`,
        );
    let history: Activity[] | undefined;
    if (get("activityHistory")) {
      try {
        history = historySchema.parse(JSON.parse(get("activityHistory")));
      } catch {
        errors.push(
          "Activity history must be a valid JSON array with type, message, and ISO createdAt values.",
        );
      }
    }
    if (
      get("createdAt") &&
      get("updatedAt") &&
      Date.parse(get("updatedAt")) < Date.parse(get("createdAt"))
    )
      errors.push("Updated timestamp cannot be before created timestamp.");
    const duplicate =
      result.success &&
      seen.some((a) => (id && a.id === id) || isDuplicate(a, result.data));
    if (result.success && !errors.length) seen.push({ ...result.data, id });
    return {
      row: index + 2,
      data: result.success ? result.data : undefined,
      id: id || undefined,
      createdAt: get("createdAt") || undefined,
      updatedAt: get("updatedAt") || undefined,
      history,
      errors,
      duplicate,
      label: `${raw.company || "Missing company"} · ${raw.position || "Missing position"}`,
    };
  });
}
export function safeCell(value: string) {
  return /^[\s]*[=+\-@'\t\r\n]/.test(value) ? `'${value}` : value;
}
export function exportCSV(records: ApplicationRecord[]) {
  return (
    "\uFEFF" +
    Papa.unparse(
      {
        fields: CSV_FIELDS,
        data: records.map((a) =>
          CSV_FIELDS.map((k) => {
            if (k === "formatVersion") return "internshiphq-v1";
            if (k === "activityHistory")
              return JSON.stringify(
                a.activities.map(({ type, message, createdAt }) => ({
                  type,
                  message,
                  createdAt,
                })),
              );
            return safeCell(String(a[k as keyof ApplicationRecord] ?? ""));
          }),
        ),
      },
      { newline: "\r\n", quotes: true },
    )
  );
}
