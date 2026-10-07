import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import type { DailyPrioritiesResponse, User } from "@/lib/types";
import { DailyOperationsQueue } from "@/components/DailyOperationsQueue";
import { LanguageProvider } from "@/providers/LanguageProvider";

const mockAuth = vi.hoisted(() => ({
  user: {
    id: "u-admin",
    email: "admin@example.test",
    display_name: "Admin User",
    role: "ADMIN" as User["role"],
    linked_entity_type: null,
    linked_entity_id: null,
  } as User | null,
  refresh: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: mockAuth.user, loading: false, refresh: mockAuth.refresh, logout: mockAuth.logout }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/command-center",
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const mockPrioritiesData: DailyPrioritiesResponse = {
  source: "synthetic",
  synthetic_data: true,
  serving_mode: "batch",
  scoring_formula: "priority_score = round((0.45 * severity + 0.35 * urgency + 0.20 * confidence) * 100, 1)",
  briefing: {
    as_of_date: "2026-09-30",
    total_actions_flagged: 12,
    high_priority_count: 5,
    medium_priority_count: 7,
    low_priority_count: 0,
    agent_cases_count: 6,
    merchant_cases_count: 6,
    top_operational_reason: "Severe liquidity stress before peak cash-out period",
    top_recommended_action: "Arrange additional float / cash support before peak period",
    briefing_text_en: "Today, 6 agents show elevated liquidity stress, 6 merchants require churn-related follow-up. 5 total cases demand immediate managerial attention.",
    briefing_text_bn: "আজকে ৬টি এজেন্টের লিকুইডিটি চাপ চিহ্নিত হয়েছে, ৬টি মার্চেন্টের জন্য নিষ্ক্রিয়তা প্রতিরোধে ফলো-আপ প্রয়োজন।",
  },
  items: [
    {
      priority_rank: 1,
      priority_score: 98.2,
      priority_level: "HIGH",
      entity_id: "AGT00025",
      entity_type: "agent",
      entity_name_or_category: "Agent (Retail)",
      district: "Dhaka",
      location_id: "LOC0013",
      reason: "Severe liquidity stress before peak cash-out period",
      evidence: "Predicted cash-out: 42,500 BDT; Liquidity stress: 94.2% (Risk band: CRITICAL)",
      recommended_action: "Contact agent and arrange emergency float / cash support before peak window",
      expected_value_score: 1500,
      expected_value_label: "Prevent failed cash-out transactions and agent cash stockout",
      suggested_owner: "Agent Operations",
      suggested_demo_sla: "24h · Next business day contact",
      risk_or_opportunity: "RISK",
      source_model_or_rule: "LightGBM Regressor (Operational P90 Buffer)",
      confidence_label: "High quality (Validated LightGBM batch)",
      source_modules: ["liquidity", "agent_performance"],
      review_status: "PENDING_REVIEW",
      intervention_id: null,
      future_data_required: ["Real-time live wallet float balance"],
    },
    {
      priority_rank: 2,
      priority_score: 94.3,
      priority_level: "HIGH",
      entity_id: "MRC00042",
      entity_type: "merchant",
      entity_name_or_category: "Grocery (Small)",
      district: "Chattogram",
      location_id: "LOC0020",
      reason: "High inactivity / 30-day merchant churn risk signal",
      evidence: "30-day inactivity model flagged risk (idle 28d, probability: 82.5%)",
      recommended_action: "Field officer follow-up visit and merchant retention campaign review",
      expected_value_score: 8500,
      expected_value_label: "Prevent merchant attrition and retain wallet transaction volume",
      suggested_owner: "Merchant Operations",
      suggested_demo_sla: "48h · Field officer visit",
      risk_or_opportunity: "RISK",
      source_model_or_rule: "LightGBM Classifier (Phase 2 Forward Hazard v2.0)",
      confidence_label: "High quality (Reconstructed exact feature match)",
      source_modules: ["churn"],
      review_status: "PENDING_REVIEW",
      intervention_id: null,
      future_data_required: ["Real-time Bangla QR scan log"],
    },
  ],
  total: 2,
  limit: 40,
  offset: 0,
};

describe("Daily Operations Queue Component", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/v1/operations/daily-priorities")) {
        return Promise.resolve(mockPrioritiesData);
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => cleanup());

  it("renders Morning Briefing with deterministic facts and KPI chips", async () => {
    render(
      <LanguageProvider>
        <DailyOperationsQueue />
      </LanguageProvider>
    );

    expect(await screen.findByText(/GOOD MORNING — DAILY MFS OPERATIONS BRIEF/i)).toBeInTheDocument();
    expect(screen.getByText(/Today, 6 agents show elevated liquidity stress/i)).toBeInTheDocument();
    expect(screen.getByText("AGT00025")).toBeInTheDocument();
    expect(screen.getByText("MRC00042")).toBeInTheDocument();
  });

  it("renders Synthetic Example scenario card clearly labeled", async () => {
    render(
      <LanguageProvider>
        <DailyOperationsQueue />
      </LanguageProvider>
    );

    const tabButton = await screen.findByRole("button", { name: /Worked Case Studies/i });
    fireEvent.click(tabButton);

    expect(await screen.findByText(/CANONICAL CASE STUDIES/i)).toBeInTheDocument();
    expect(screen.getByText(/WORKED AGENT CASE/i)).toBeInTheDocument();
    expect(screen.getByText(/AGT00025/i)).toBeInTheDocument();
    expect(screen.getByText(/MRC000001/i)).toBeInTheDocument();
  });

  it("submits proposal to Action Review when clicking Review Action", async () => {
    apiFetchMock.mockImplementation((url, init) => {
      if (typeof url === "string" && url.includes("/api/v1/operations/daily-priorities")) {
        return Promise.resolve(mockPrioritiesData);
      }
      if (typeof url === "string" && url.includes("/api/v1/interventions") && init?.method === "POST") {
        return Promise.resolve({ id: "int-new-123" });
      }
      return Promise.resolve({});
    });

    render(
      <LanguageProvider>
        <DailyOperationsQueue />
      </LanguageProvider>
    );

    const reviewButtons = await screen.findAllByRole("button", { name: /review action/i });
    expect(reviewButtons.length).toBeGreaterThan(0);

    await userEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/v1/interventions",
        expect.objectContaining({
          method: "POST",
          body: expect.objectContaining({
            target_type: "agent",
            target_id: "AGT00025",
          }),
        })
      );
    });

    expect(await screen.findByText(/Proposal created in Action Review/i)).toBeInTheDocument();
  });

  it("toggles and displays Production Data Needed requirements", async () => {
    render(
      <LanguageProvider>
        <DailyOperationsQueue />
      </LanguageProvider>
    );

    const toggleButton = await screen.findByRole("button", { name: /What Data We Need in Production/i });
    fireEvent.click(toggleButton);

    expect(await screen.findByText(/PRODUCTION UPAY DATA REQUIRED/i)).toBeInTheDocument();
    expect(screen.getByText(/Agent Live Float Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Real-time core banking \/ MFS ledger balance/i)).toBeInTheDocument();
  });
});
