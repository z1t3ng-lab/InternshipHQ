import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, readJson, HttpError } from "@/lib/http";
import { documentSelect } from "@/lib/documents";
type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) throw new HttpError(404, "This document could not be found.");
    return new Response(new Uint8Array(doc.content), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="document.${doc.mimeType === "application/pdf" ? "pdf" : "docx"}"; filename*=UTF-8''${encodeURIComponent(doc.fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
        "Content-Length": String(doc.size),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const body = await readJson(request);
    if (typeof body.archived !== "boolean")
      throw new HttpError(400, "Choose archive or restore.");
    const { id } = await context.params;
    const existing = await db.document.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing)
      throw new HttpError(404, "This document could not be found.");
    return NextResponse.json(
      await db.document.update({
        where: { id },
        data: { archived: body.archived },
        select: documentSelect,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
