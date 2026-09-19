/**
 * Client-side wrapper over the API's two response shapes (see src/lib/api.ts).
 * It exists so no component has to remember whether an error lives at
 * `body.error` or `body.error.message`, and so a non-JSON response (a proxy
 * error page, say) surfaces as a readable message rather than a parse crash.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details?: Record<string, string> };

const NETWORK_MESSAGE = "Could not reach the server. Check your connection and try again.";

export async function apiFetch<T>(
  input: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    return { ok: false, code: "network_error", message: NETWORK_MESSAGE };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      code: "bad_response",
      message: `The server returned an unexpected response (${response.status}).`,
    };
  }

  if (response.ok) {
    return { ok: true, data: (body as { data: T }).data };
  }

  const error = (body as { error?: { code?: string; message?: string; details?: Record<string, string> } })
    .error;

  return {
    ok: false,
    code: error?.code ?? "unknown_error",
    message: error?.message ?? `Request failed (${response.status}).`,
    details: error?.details,
  };
}

export async function postJson<T>(url: string, payload: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
