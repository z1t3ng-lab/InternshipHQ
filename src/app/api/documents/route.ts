import { NextResponse } from "next/server";
import { listDocuments, uploadDocument } from "@/lib/documents";
import { MAX_DOCUMENT_BYTES } from "@/lib/document-types";
import { apiError, checkOrigin, HttpError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await listDocuments(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data"))
      throw new HttpError(415, "Choose a document using the upload form.");
    if (!request.body) throw new HttpError(400, "Choose a document to upload.");
    // Bound multipart bytes even when a client omits Content-Length.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_DOCUMENT_BYTES + 64 * 1024) {
        await reader.cancel();
        throw new HttpError(413, "Choose a document no larger than 10 MB.");
      }
      chunks.push(value);
    }
    let form: FormData;
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": contentType },
      }).formData();
    } catch {
      throw new HttpError(
        400,
        "Could not read the upload. Choose the file again and retry.",
      );
    }
    const file = form.get("file");
    if (!(file instanceof File))
      throw new HttpError(400, "Choose a PDF or DOCX file.");
    return NextResponse.json(
      await uploadDocument(
        {
          name: form.get("name"),
          version: form.get("version"),
          kind: form.get("kind"),
        },
        file,
      ),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
