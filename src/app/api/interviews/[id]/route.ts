import { NextResponse } from "next/server";
import { saveInterview } from "@/lib/interviews";
import { apiError, readJson } from "@/lib/http";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      await saveInterview(await readJson(request), (await context.params).id),
    );
  } catch (e) {
    return apiError(e);
  }
}
