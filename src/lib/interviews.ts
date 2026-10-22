import { z } from "zod";
import { db } from "./db";
import { HttpError } from "./http";
import { validDate } from "./domain";
import { localInterviewTime } from "./interview-time";
export function interviewInstant(
  local: string,
  zone: string,
  occurrence: "earlier" | "later" = "earlier",
) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !validDate(local.slice(0, 10)) ||
    +local.slice(11, 13) > 23 ||
    +local.slice(14) > 59
  )
    throw new HttpError(400, "Enter a valid interview date and time.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  } catch {
    throw new HttpError(
      400,
      "Enter a valid time zone, such as America/Toronto.",
    );
  }
  const naive = Date.parse(`${local}:00Z`);
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = naive + delta;
    offsets.add(
      Date.parse(
        `${localInterviewTime(new Date(sample).toISOString(), zone)}:00Z`,
      ) - sample,
    );
  }
  const matches = [...offsets]
    .map((offset) => naive - offset)
    .filter(
      (t) => localInterviewTime(new Date(t).toISOString(), zone) === local,
    )
    .sort((a, b) => a - b);
  if (!matches.length)
    throw new HttpError(
      400,
      "That local time does not exist because the clocks move forward. Choose another time.",
    );
  return new Date(occurrence === "later" ? matches.at(-1)! : matches[0]);
}
const text = z.string().max(10000).default("");
export const interviewSchema = z.object({
  applicationId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  startLocal: z.string(),
  timeZone: z.string().max(100),
  occurrence: z.enum(["earlier", "later"]).default("earlier"),
  duration: z.number().int().min(1).max(480).default(60),
  interviewer: text,
  location: text,
  preparation: text,
  notes: text,
  meetingUrl: z
    .string()
    .refine(
      (v) => !v || (/^https?:\/\//i.test(v) && URL.canParse(v)),
      "Use a full https:// meeting URL.",
    )
    .default(""),
  state: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
});
export async function saveInterview(raw: unknown, id?: string) {
  const { startLocal, occurrence, ...data } = interviewSchema.parse(raw);
  const startAt = interviewInstant(startLocal, data.timeZone, occurrence);
  return db.$transaction(async (tx) => {
    await tx.application.findUniqueOrThrow({
      where: { id: data.applicationId },
    });
    const record = id
      ? await tx.interview.update({ where: { id }, data: { ...data, startAt } })
      : await tx.interview.create({ data: { ...data, startAt } });
    await tx.activity.create({
      data: {
        applicationId: data.applicationId,
        type: "interview",
        message: `${id ? "Updated" : "Scheduled"} interview: ${data.title} · ${startLocal.replace("T", " ")} ${data.timeZone} · ${data.state}`,
      },
    });
    return record;
  });
}
