import type { ApiFailure } from "@/lib/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  correlationId?: string;

  constructor(status: number, payload?: Partial<ApiFailure>) {
    super(payload?.message ?? "The service could not complete this request.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code ?? "network_error";
    this.correlationId = payload?.correlation_id;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCookie("mfs_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, { code: "network_error", message: "The intelligence service is unavailable. Check your connection and try again." });
  }

  if (!response.ok) {
    let payload: Partial<ApiFailure> = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("mfs:unauthorized"));
    }
    throw new ApiError(response.status, payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  if (error.status === 401) return "Your session has ended. Sign in to continue.";
  if (error.status === 403) return "Your account does not have access to this information or action.";
  if (error.status === 404) return "This information is not available.";
  if (error.status === 422) return "Check the information and try again.";
  if (error.status === 429) return "Too many attempts. Wait a little before trying again.";
  if (error.status >= 500) return "The service is having trouble. Please try again shortly.";
  return error.message;
}