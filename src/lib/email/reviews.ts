import { z } from "zod";
import { db } from "../db";
import { HttpError } from "../http";
import { applicationSchema, STATUSES } from "../domain";
import { parseEmail } from "./parser";
const inputSchema = z.object({
  subject: z.string().max(500).optional(),
  sender: z.string().max(500).optional(),
  body: z.string().max(100000).optional(),
  eml: z.string().max(1000000).optional(),
  sourceUrl: applicationSchema.shape.sourceEmailUrl,
});
export async function importEmail(raw: unknown) {
  const input = inputSchema.parse(raw);
  const data = parseEmail(input);
  return db.emailReview.upsert({
    where: { fingerprint: data.fingerprint },
    update: {},
    create: { ...data, sourceUrl: input.sourceUrl },
  });
}
const reviewSchema = z.object({
  action: z.enum(["accept", "dismiss"]),
  applicationId: z.string().optional(),
  expectedUpdatedAt: z.string().optional(),
  status: z.enum(STATUSES).optional(),
  nextAction: applicationSchema.shape.nextAction.optional(),
  nextActionDue: applicationSchema.shape.nextActionDue.optional(),
  dateApplied: applicationSchema.shape.dateApplied.optional(),
});
export async function reviewEmail(id: string, raw: unknown) {
  const input = reviewSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const review = await tx.emailReview.findUniqueOrThrow({ where: { id } });
    if (review.state !== "pending")
      throw new HttpError(409, "This email has already been reviewed.");
    if (input.action === "dismiss")
      return tx.emailReview.update({
        where: { id },
        data: { state: "dismissed", reviewedAt: new Date() },
      });
    if (!input.applicationId)
      throw new HttpError(400, "Choose the application this email belongs to.");
    const before = await tx.application.findUniqueOrThrow({
      where: { id: input.applicationId },
    });
    if (before.updatedAt.toISOString() !== input.expectedUpdatedAt)
      throw new HttpError(
        409,
        "This application changed since you opened the review. Reload the workspace and review the current values.",
      );
    const patch = Object.fromEntries(
      ["status", "nextAction", "nextActionDue", "dateApplied"]
        .filter((k) => input[k as keyof typeof input] !== undefined)
        .map((k) => [k, input[k as keyof typeof input]]),
    );
    const data = applicationSchema.parse({
      ...before,
      ...patch,
      ...(review.sourceUrl ? { sourceEmailUrl: review.sourceUrl } : {}),
    });
    const changedStatus = data.status !== before.status;
    const now = new Date();
    await tx.application.update({
      where: { id: before.id },
      data: {
        ...data,
        activities: {
          create: {
            type: "email",
            createdAt: now,
            message: `Reviewed email: ${review.subject}${changedStatus ? ` · Status changed from ${before.status} to ${data.status}` : ""}${input.nextAction !== undefined ? ` · Next action: ${data.nextAction}` : ""}${input.dateApplied !== undefined ? ` · Date applied: ${data.dateApplied}` : ""}${review.sourceUrl ? ` · ${review.sourceUrl}` : ""}`,
          },
        },
        ...(changedStatus
          ? {
              statusEvents: {
                create: { status: data.status, occurredAt: now },
              },
            }
          : {}),
      },
    });
    return tx.emailReview.update({
      where: { id },
      data: { state: "accepted", applicationId: before.id, reviewedAt: now },
    });
  });
}
