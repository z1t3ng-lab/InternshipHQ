import { NextResponse } from "next/server";
import { createApplication, listApplications } from "@/lib/applications";
import { apiError, readJson } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await listApplications());
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return NextResponse.json(
      await createApplication(body.data, body.allowDuplicate === true),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
