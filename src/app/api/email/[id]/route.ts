import { NextResponse } from "next/server";
import { reviewEmail } from "@/lib/email/reviews";
import { apiError, readJson } from "@/lib/http";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return NextResponse.json(
      await reviewEmail((await context.params).id, await readJson(request)),
    );
  } catch (e) {
    return apiError(e);
  }
}
