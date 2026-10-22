import { NextResponse } from "next/server";
import { importBackup } from "@/lib/backups";
import { checkOrigin, apiError, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Choose a backup file.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 250 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, "Choose a backup no larger than 250 MB.");
      }
      chunks.push(value);
    }
    return NextResponse.json(importBackup(Buffer.concat(chunks)));
  } catch (e) {
    return apiError(e);
  }
}
