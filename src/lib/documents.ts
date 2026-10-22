import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { HttpError } from "./http";
import type { ApplicationInput } from "./domain";
import {
  DOCUMENT_KINDS,
  DOCUMENT_SLOTS,
  MAX_DOCUMENT_BYTES,
  documentLabel,
} from "./document-types";

export const documentSelect = {
  id: true,
  name: true,
  version: true,
  kind: true,
  fileName: true,
  mimeType: true,
  size: true,
  sha256: true,
  archived: true,
  createdAt: true,
} as const;
const metadataSchema = z.object({
  name: z.string().trim().min(1, "Give this document a name.").max(120),
  version: z
    .string()
    .trim()
    .min(1, "Add a version label, such as v1 or October 2026.")
    .max(80),
  kind: z.enum(DOCUMENT_KINDS),
});
export async function listDocuments() {
  return db.document.findMany({
    select: documentSelect,
    orderBy: { createdAt: "desc" },
  });
}
export async function uploadDocument(raw: unknown, file: File) {
  const metadata = metadataSchema.parse(raw);
  if (!file.size)
    throw new HttpError(400, "Choose a nonempty PDF or DOCX file.");
  if (file.size > MAX_DOCUMENT_BYTES)
    throw new HttpError(413, "Choose a document no larger than 10 MB.");
  const fileName = file.name
    .split(/[\\/]/)
    .at(-1)!
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 240);
  const content = Buffer.from(await file.arrayBuffer());
  const pdf =
    /\.pdf$/i.test(fileName) && content.subarray(0, 5).toString() === "%PDF-";
  const docx =
    /\.docx$/i.test(fileName) &&
    content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    content.includes(Buffer.from("word/document.xml"));
  if (!pdf && !docx)
    throw new HttpError(
      400,
      "The file must be a PDF or Word DOCX document. Check its format and try again.",
    );
  return db.document.create({
    data: {
      ...metadata,
      fileName,
      content,
      size: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      mimeType: pdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
    select: documentSelect,
  });
}

// Versions are immutable and never hard-deleted. Archive hides choices for new
// applications while keeping every previously selected file available.
export async function resolveDocuments(
  tx: Prisma.TransactionClient,
  data: ApplicationInput,
  before?: ApplicationInput,
  importing = false,
) {
  for (const slot of DOCUMENT_SLOTS) {
    const id = data[slot.id];
    if (!id) continue;
    const doc = await tx.document.findUnique({
      where: { id },
      select: documentSelect,
    });
    if (!doc || !(slot.kinds as readonly string[]).includes(doc.kind)) {
      if (importing) {
        data[slot.id] = "";
        continue;
      }
      throw new HttpError(
        400,
        `Choose an available ${slot.label.toLowerCase()} from your document library.`,
        {
          fields: {
            [slot.id]: "This document is missing or has the wrong type.",
          },
        },
      );
    }
    if (doc.archived && before?.[slot.id] !== id && !importing)
      throw new HttpError(
        400,
        `Restore ${doc.name} in Documents before selecting it for another application.`,
        { fields: { [slot.id]: "This version is archived." } },
      );
    data[slot.snapshot] = documentLabel(doc);
  }
  return data;
}
