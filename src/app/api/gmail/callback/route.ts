import { finishGmailConnection } from "@/lib/email/gmail";
import { HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let success = false,
    message = "";
  try {
    await finishGmailConnection(
      params.get("state") || "",
      params.get("code") || "",
      params.has("error"),
    );
    success = true;
    message =
      "Gmail is connected. Return to InternshipHQ and choose Check Gmail to import messages for review. You can close this browser tab.";
  } catch (e) {
    message =
      e instanceof HttpError
        ? e.message
        : "Could not connect Gmail. Return to InternshipHQ and try again.";
  }
  const escaped = message.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InternshipHQ · Gmail</title><body><main><h1>${success ? "Gmail connected" : "Gmail connection"}</h1><p>${escaped}</p></main></body></html>`,
    {
      status: success ? 200 : 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
}
