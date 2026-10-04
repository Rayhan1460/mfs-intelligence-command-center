import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import { AppShell, ErrorState } from "@/components/ui";
import LoginPage from "@/app/login/page";

const mockAuth = vi.hoisted(() => ({ user: null as User | null, refresh: vi.fn(), logout: vi.fn() }));
const mockRouter = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: mockAuth.user, loading: false, refresh: mockAuth.refresh, logout: mockAuth.logout }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/command-center",
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function user(role: User["role"]): User {
  return { id: "u-1", email: "judge@example.test", display_name: "Demo User", role, linked_entity_type: null, linked_entity_id: null };
}

describe("Phase 4 frontend behavior", () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.refresh.mockReset();
    mockRouter.replace.mockReset();
    apiFetchMock.mockReset();
  });

  afterEach(() => cleanup());

  it("submits credentials to the session API and redirects after login", async () => {
    const userEventApi = userEvent.setup();
    apiFetchMock.mockResolvedValueOnce({ user: user("ANALYST") });
    mockAuth.refresh.mockResolvedValue(user("ANALYST"));
    render(<LoginPage />);

    await userEventApi.type(screen.getByLabelText("Email"), "analyst@example.test");
    await userEventApi.type(screen.getByLabelText("Password"), "not-a-real-password");
    await userEventApi.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/auth/login", expect.objectContaining({ method: "POST" })));
    expect(mockRouter.replace).toHaveBeenCalledWith("/command-center");
  });

  it("shows a safe rate-limit message without exposing backend details", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(429, { message: "private server detail", code: "login_throttled" }));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "judge@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fake-test-value" } });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Too many (sign-in )?attempts/);
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
  });

  it("renders role-appropriate links but leaves backend authorization authoritative", () => {
    mockAuth.user = user("ANALYST");
    render(<AppShell><div>Protected content</div></AppShell>);
    expect(screen.getAllByRole("link", { name: /merchants/i })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /agents/i })[0]).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /models|responsible ai/i })).not.toBeInTheDocument();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("redirects an unauthenticated user away from protected workspace content", async () => {
    mockAuth.user = null;
    render(<AppShell><div>Protected content</div></AppShell>);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders API failures as an explicit unavailable state", () => {
    render(<ErrorState message="The service is unavailable." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Information unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent("The service is unavailable.");
  });

  it("provides a reduced-motion CSS fallback", async () => {
    const css = await readFile(resolve(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: .01ms");
  });

  it("shows Enter Demo button when NEXT_PUBLIC_DEMO_MODE is true and authenticates", async () => {
    const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    try {
      const userEventApi = userEvent.setup();
      apiFetchMock.mockResolvedValueOnce({ user: user("ADMIN") });
      mockAuth.refresh.mockResolvedValue(user("ADMIN"));
      render(<LoginPage />);

      const demoButton = screen.getByRole("button", { name: /enter demo/i });
      expect(demoButton).toBeInTheDocument();
      await userEventApi.click(demoButton);

      await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/auth/demo-login", expect.objectContaining({ method: "POST" })));
      expect(mockRouter.replace).toHaveBeenCalledWith("/command-center");
    } finally {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
    }
  });
});