import { NextResponse } from "next/server";
import { apiError, readJson, HttpError } from "@/lib/http";
import {
  gmailStatus,
  configureGmail,
  configureGmailSync,
  startGmailConnection,
  syncGmail,
  disconnectGmail,
} from "@/lib/email/gmail";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(gmailStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const data = await readJson(request);
    if (data.action === "configure")
      return NextResponse.json(configureGmail(data.client));
    if (data.action === "settings")
      return NextResponse.json(configureGmailSync(data));
    if (data.action === "connect")
      return NextResponse.json(
        startGmailConnection(
          `http://${request.headers.get("host") || new URL(request.url).host}`,
        ),
      );
    if (data.action === "sync") return NextResponse.json(await syncGmail());
    if (data.action === "disconnect")
      return NextResponse.json(await disconnectGmail());
    throw new HttpError(400, "Choose a Gmail action.");
  } catch (e) {
    return apiError(e);
  }
}
