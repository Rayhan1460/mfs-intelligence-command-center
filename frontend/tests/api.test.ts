import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "mfs_csrf=; Max-Age=0; path=/";
});

describe("typed API client session contract", () => {
  it("includes cookies and copies the readable CSRF cookie into the write header", async () => {
    document.cookie = "mfs_csrf=csrf-value-123; path=/";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/interventions", { method: "POST", body: { target_type: "merchant" } });

    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/interventions");
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).get("X-CSRF-Token")).toBe("csrf-value-123");
    expect(new Headers(request.headers).get("Content-Type")).toBe("application/json");
  });

  it("does not attach CSRF to read-only requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/merchants");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.credentials).toBe("include");
    expect(new Headers(request.headers).has("X-CSRF-Token")).toBe(false);
  });
});
