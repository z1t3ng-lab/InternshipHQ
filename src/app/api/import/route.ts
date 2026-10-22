import { NextResponse } from "next/server";
import { z } from "zod";
import { runImport } from "@/lib/importer";
import { apiError, readJson } from "@/lib/http";
const schema = z.object({
  csv: z.string().max(5_000_000),
  mapping: z.record(z.string(), z.string()),
  allowDuplicates: z.boolean().default(false),
  previewOnly: z.boolean().default(true),
});
export async function POST(request: Request) {
  try {
    const b = schema.parse(await readJson(request));
    return NextResponse.json(
      await runImport(b.csv, b.mapping, b.allowDuplicates, b.previewOnly),
    );
  } catch (e) {
    return apiError(e);
  }
}
