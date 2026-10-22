import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { apiError, readJson, HttpError } from "@/lib/http";
import {
  backupDirectory,
  backupSettings,
  listBackups,
  createBackup,
  previewBackup,
  restoreBackup,
  saveBackupSettings,
  backupPath,
} from "@/lib/backups";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const name = query.get("name");
    if (name && query.has("download"))
      return new Response(readFileSync(backupPath(name)), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    if (name) return NextResponse.json(previewBackup(name));
    return NextResponse.json({
      settings: backupSettings(),
      backups: listBackups(),
      directory: backupDirectory(),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const data = await readJson(request);
    if (data.action === "create")
      return NextResponse.json({ name: await createBackup() });
    if (data.action === "settings" && typeof data.enabled === "boolean")
      return NextResponse.json(saveBackupSettings({ enabled: data.enabled }));
    if (
      data.action === "restore" &&
      data.confirmation === "RESTORE" &&
      typeof data.name === "string"
    )
      return NextResponse.json(restoreBackup(data.name));
    throw new HttpError(
      400,
      "Confirm the backup and type RESTORE before restoring.",
    );
  } catch (e) {
    return apiError(e);
  }
}
