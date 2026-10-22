import { db } from "./db";
import {
  applicationSchema,
  isDuplicate,
  type ApplicationInput,
} from "./domain";
import { HttpError } from "./http";
import { z } from "zod";
export const includeActivities = {
  activities: { orderBy: { createdAt: "desc" as const } },
};
export async function listApplications() {
  return db.application.findMany({
    orderBy: { updatedAt: "desc" },
    include: includeActivities,
  });
}
export async function createApplication(raw: unknown, allowDuplicate = false) {
  const data = applicationSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const matches = (await tx.application.findMany()).filter((a) =>
      isDuplicate(data, a),
    );
    if (matches.length && !allowDuplicate)
      throw new HttpError(
        409,
        "A similar application already exists. Save separately if this is intentional.",
        {
          duplicates: matches.map((a) => ({
            id: a.id,
            company: a.company,
            position: a.position,
          })),
        },
      );
    return tx.application.create({
      data: {
        ...data,
        activities: {
          create: {
            type: "created",
            message: `Application created · ${data.status}`,
          },
        },
      },
      include: includeActivities,
    });
  });
}
export async function updateApplication(
  id: string,
  raw: unknown,
  allowDuplicate = false,
) {
  // Validate after merging: parsing a partial schema with defaults can reset
  // omitted fields in Zod 4 (for example, a status-only update erasing notes).
  const patch = z.record(z.string(), z.unknown()).parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.application.findUniqueOrThrow({ where: { id } });
    const data = applicationSchema.parse({ ...before, ...patch });
    if (
      ["company", "position", "jobUrl"].some(
        (k) =>
          data[k as keyof ApplicationInput] !==
          before[k as keyof ApplicationInput],
      )
    ) {
      const match = (
        await tx.application.findMany({ where: { id: { not: id } } })
      ).find((a) => isDuplicate(data, a));
      if (match && !allowDuplicate)
        throw new HttpError(
          409,
          "A similar application already exists. Save separately if this is intentional.",
          {
            duplicates: [
              {
                id: match.id,
                company: match.company,
                position: match.position,
              },
            ],
          },
        );
    }
    const changed = Object.keys(data).filter(
      (k) =>
        data[k as keyof ApplicationInput] !==
        before[k as keyof ApplicationInput],
    );
    if (!changed.length)
      return tx.application.findUniqueOrThrow({
        where: { id },
        include: includeActivities,
      });
    const activities = [];
    if (before.status !== data.status)
      activities.push({
        type: "status",
        message: `Status changed from ${before.status} to ${data.status}`,
      });
    const other = changed.filter((k) => k !== "status");
    if (other.length)
      activities.push({
        type: "edited",
        message: `Updated ${other.join(", ")}`,
      });
    return tx.application.update({
      where: { id },
      data: { ...data, activities: { create: activities } },
      include: includeActivities,
    });
  });
}
export async function completeAction(id: string, raw: unknown) {
  const next = applicationSchema
    .pick({ nextAction: true, nextActionDue: true })
    .parse(raw);
  return db.$transaction(async (tx) => {
    const current = await tx.application.findUniqueOrThrow({ where: { id } });
    if (!current.nextAction)
      throw new HttpError(409, "This action has already been completed.");
    return tx.application.update({
      where: { id },
      data: {
        ...next,
        activities: {
          create: {
            type: "completed",
            message: `Completed: ${current.nextAction}${current.nextActionDue ? ` (due ${current.nextActionDue})` : ""}${next.nextAction ? `. Next: ${next.nextAction}` : ""}`,
          },
        },
      },
      include: includeActivities,
    });
  });
}
