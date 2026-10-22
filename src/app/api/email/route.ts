import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importEmail } from "@/lib/email/reviews";
import { apiError, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      await db.emailReview.findMany({ orderBy: { createdAt: "desc" } }),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    return NextResponse.json(await importEmail(await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
