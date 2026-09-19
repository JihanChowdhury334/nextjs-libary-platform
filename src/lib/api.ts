import { NextResponse } from "next/server";

/**
 * Every API route answers with one of two shapes:
 *
 *   success  { "data": <payload> }
 *   failure  { "error": { "code": <slug>, "message": <human text>, "details"?: {...} } }
 *
 * Clients can branch on `res.ok` and read `body.error.code` for control flow and
 * `body.error.message` for display, without parsing prose.
 */
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, string>;
};

export type ApiFailure = { error: ApiError };
export type ApiSuccess<T> = { data: T };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data }, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string>
) {
  return NextResponse.json<ApiFailure>(
    { error: details ? { code, message, details } : { code, message } },
    { status }
  );
}

export const unauthorized = () =>
  fail(401, "unauthenticated", "Sign in to continue.");

export const forbidden = () =>
  fail(403, "forbidden", "Your account does not have permission to do that.");

export const notFound = (what = "Resource") =>
  fail(404, "not_found", `${what} was not found.`);

export const badRequest = (message: string, details?: Record<string, string>) =>
  fail(400, "invalid_request", message, details);

/**
 * Terminal handler for anything that escaped the route body. The thrown value is
 * logged server-side and never serialised into the response: driver errors carry
 * SQL text, constraint names and sometimes parameter values.
 */
export function serverError(context: string, error: unknown) {
  console.error(`[api] ${context}`, error);
  return fail(500, "internal_error", "Something went wrong. Please try again.");
}

/** Parses a JSON request body, turning malformed input into a 400 rather than a 500. */
export async function readJson(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: badRequest("Request body must be valid JSON."),
    };
  }
}
