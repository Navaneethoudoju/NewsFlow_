const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Two error envelope shapes exist across the API:
//   { error: "message" }                              (legacy /auth/* handlers)
//   { success: false, error: { code, message, ... } }  (everything through errorHandler)
// This normalizes both so the rest of the app only deals with ApiError.
function extractError(status: number, body: any): ApiError {
  if (body && typeof body.error === "object" && body.error !== null) {
    return new ApiError(status, body.error.message ?? "Request failed.", body.error.code, body.error.details);
  }
  if (body && typeof body.error === "string") {
    return new ApiError(status, body.error);
  }
  return new ApiError(status, `Request failed (${status}).`);
}

interface ApiOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildQuery(query?: ApiOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// credentials: "include" is required so the httpOnly auth cookie is sent —
// without it, every request past login would look unauthenticated.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { query, ...init } = options;
  const res = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw extractError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export async function apiCsv(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw extractError(res.status, body);
  }
  return res.blob();
}

export const API_BASE = API_URL;
