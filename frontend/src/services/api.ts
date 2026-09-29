/** Thin HTTP client for the practice API (see `backend/`). */

export const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000";

const TOKEN_KEY = "amani-token";

let token: string | null = null;
let tokenLoaded = false;

export function getToken(): string | null {
  if (!tokenLoaded && typeof window !== "undefined") {
    token = localStorage.getItem(TOKEN_KEY);
    tokenLoaded = true;
  }
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  tokenLoaded = true;
  if (typeof window === "undefined") return;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const auth = getToken();
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);

  const response = await fetch(`${API_URL}/api${path}`, init);

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}
