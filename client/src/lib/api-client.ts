export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshInFlight: Promise<boolean> | null = null;
const SESSION_HINT = "daymark-session-hint";

function csrfCookie() {
  const part = document.cookie.split("; ").find(value => value.startsWith("pw_csrf="));
  return part ? decodeURIComponent(part.slice("pw_csrf=".length)) : null;
}
export function markSessionPresent() {
  localStorage.setItem(SESSION_HINT, "1");
}
export function clearSessionHint() {
  localStorage.removeItem(SESSION_HINT);
}
async function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": csrfCookie() ?? "" }
    }).then(response => response.ok).catch(() => false).finally(() => { refreshInFlight = null; });
  }
  const refreshed = await refreshInFlight;
  if (!refreshed) clearSessionHint();
  return refreshed;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = csrfCookie();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && !retried && localStorage.getItem(SESSION_HINT) === "1" && !["/auth/login", "/auth/refresh"].includes(path)) {
    if (await refreshOnce()) return api<T>(path, init, true);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
    throw new ApiError(payload?.error?.message ?? `Request failed (${response.status})`, response.status, payload?.error?.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
