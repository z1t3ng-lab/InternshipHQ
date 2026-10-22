import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateApplication } from "@/lib/applications";
import { apiError, readJson } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return NextResponse.json(
      await updateApplication(id, body.data, body.allowDuplicate === true),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await readJson(request);
    const { id } = await context.params;
    await db.application.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
