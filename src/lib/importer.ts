import { db } from "./db";
import { parseCSV, previewImport, type ColumnMapping } from "./csv";
import { HttpError } from "./http";
import { includeActivities } from "./applications";
import type { ApplicationRecord } from "./domain";
export async function runImport(
  csv: string,
  mapping: ColumnMapping,
  allowDuplicates = false,
  previewOnly = false,
) {
  const parsed = parseCSV(csv);
  if (parsed.errors.length) throw new HttpError(400, parsed.errors.join(" "));
  const assigned = Object.values(mapping).filter(Boolean);
  if (new Set(assigned).size !== assigned.length)
    throw new HttpError(400, "Map each source column to only one field.");
  return db.$transaction(
    async (tx) => {
      const existing = JSON.parse(
        JSON.stringify(
          await tx.application.findMany({ include: includeActivities }),
        ),
      ) as ApplicationRecord[];
      const rows = previewImport(parsed, mapping, existing);
      const accepted = rows.filter(
        (r) => r.data && !r.errors.length && (allowDuplicates || !r.duplicate),
      );
      if (previewOnly)
        return {
          rows,
          accepted: accepted.length,
          skipped: rows.length - accepted.length,
        };
      const usedIds = new Set(existing.map((a) => a.id));
      for (const r of accepted) {
        const preserveId = r.id && !usedIds.has(r.id) ? r.id : undefined;
        const saved = await tx.application.create({
          data: {
            ...r.data!,
            ...(preserveId ? { id: preserveId } : {}),
            ...(r.createdAt ? { createdAt: new Date(r.createdAt) } : {}),
            ...(r.updatedAt ? { updatedAt: new Date(r.updatedAt) } : {}),
            activities: {
              create: [
                ...(r.history || []).map((a) => ({
                  ...a,
                  createdAt: new Date(a.createdAt),
                })),
                {
                  type: "imported",
                  message: "Imported from CSV",
                  createdAt: new Date(),
                },
              ],
            },
          },
        });
        usedIds.add(saved.id);
      }
      return {
        rows,
        accepted: accepted.length,
        skipped: rows.length - accepted.length,
      };
    },
    { timeout: 60000 },
  );
}
