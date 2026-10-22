import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveInterview } from "@/lib/interviews";
import { apiError, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      await db.interview.findMany({ orderBy: { startAt: "asc" } }),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    return NextResponse.json(await saveInterview(await readJson(request)), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
