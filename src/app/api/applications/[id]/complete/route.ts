import { NextResponse } from "next/server";
import { completeAction } from "@/lib/applications";
import { apiError, readJson } from "@/lib/http";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await completeAction(id, await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
