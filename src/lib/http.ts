import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { fieldErrors } from "./domain";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next may normalize request.url to its internal hostname. The HTTP Host
  // header retains the browser-facing host and port, including localhost aliases.
  const host = request.headers.get("host") || new URL(request.url).host;
  if (origin && new URL(origin).host !== host)
    throw new HttpError(403, "This request must come from InternshipHQ.");
}
export async function readJson(request: Request) {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Expected JSON.");
  const body = await request.text();
  if (body.length > 5_000_000)
    throw new HttpError(413, "Use a file smaller than 5 MB.");
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "The request contains invalid JSON.");
  }
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        fields: fieldErrors(error),
      },
      { status: 400 },
    );
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message, ...error.details },
      { status: error.status },
    );
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2025"
  )
    return NextResponse.json(
      { error: "This application no longer exists." },
      { status: 404 },
    );
  console.error(error);
  return NextResponse.json(
    {
      error:
        "Could not save your changes. Please try again. If this continues, check the server and database.",
    },
    { status: 500 },
  );
}
