import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import AIAssistantPage from "@/app/(workspace)/ai-assistant/page";

const mockAuth = vi.hoisted(() => ({ user: null as User | null }));
const mockRouter = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: mockAuth.user, loading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/ai-assistant",
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function makeUser(role: User["role"] = "ADMIN"): User {
  return {
    id: "u-admin",
    email: "admin@example.com",
    display_name: "Admin User",
    role,
    linked_entity_type: null,
    linked_entity_id: null,
  };
}

describe("AI Copilot (/ai-assistant) Page", () => {
  beforeEach(() => {
    mockAuth.user = makeUser("ADMIN");
    apiFetchMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the AI Copilot title, subtitle, and suggested prompts", () => {
    render(<AIAssistantPage />);

    expect(screen.getAllByText("MFS Intelligence Copilot")[0]).toBeInTheDocument();
    expect(
      screen.getByText("Ask questions about merchants, agents, demand and expansion.")
    ).toBeInTheDocument();
    expect(screen.getByText("Explain MRC000001")).toBeInTheDocument();
    expect(screen.getByText("Show the demand outlook")).toBeInTheDocument();
  });

  it("clicking a suggested prompt submits query and shows loading then assistant answer with entity link", async () => {
    const userEventApi = userEvent.setup();

    let resolvePromise: (val: unknown) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    apiFetchMock.mockReturnValueOnce(pendingPromise as Promise<never>);

    render(<AIAssistantPage />);

    const chip = screen.getByText("Explain MRC000001");
    await userEventApi.click(chip);

    // Verify loading indicator is visible while request is pending
    expect(screen.getByText("Reviewing intelligence...")).toBeInTheDocument();

    // Resolve the assistant response
    resolvePromise({
      answer: "MRC000001 is a Healthcare merchant with steady operations.",
      evidence: [
        {
          source: "Merchant Profile",
          data: { category: "Healthcare", district: "Dhaka" },
        },
      ],
      entities: [
        {
          type: "merchant",
          id: "MRC000001",
          label: "MRC000001 (Healthcare)",
        },
      ],
      limitations: ["Synthetic batch data only."],
      suggested_action: null,
    });

    await waitFor(() => {
      expect(
        screen.getByText("MRC000001 is a Healthcare merchant with steady operations.")
      ).toBeInTheDocument();
    });

    // Check entity link
    const entityLink = screen.getByRole("link", { name: /MRC000001 \(Healthcare\)/i });
    expect(entityLink).toBeInTheDocument();
    expect(entityLink).toHaveAttribute("href", "/merchants/MRC000001");
  });

  it("displays friendly error message when the assistant API returns an error", async () => {
    const userEventApi = userEvent.setup();
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(403, {
        code: "forbidden",
        message: "You are not authorized to access this entity.",
      })
    );

    render(<AIAssistantPage />);

    const chip = screen.getByText("Explain MRC000001");
    await userEventApi.click(chip);

    await waitFor(() => {
      expect(
        screen.getByText("Your account does not have access to this information or action.")
      ).toBeInTheDocument();
    });
  });
});
