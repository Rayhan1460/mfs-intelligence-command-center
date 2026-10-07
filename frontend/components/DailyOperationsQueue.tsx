"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UsersRound,
  Zap,
} from "lucide-react";

import { apiFetch, friendlyError } from "@/lib/api";
import {
  CountDisplay,
  EmptyState,
  ErrorState,
  LoadingState,
  RiskBadge,
} from "@/components/ui";
import type { DailyPrioritiesResponse, PriorityActionItem } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

type PersonaRole = "all" | "ops_manager" | "agent_manager" | "merchant_manager" | "field_team";

export function DailyOperationsQueue() {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [entityFilter, setEntityFilter] = useState<"all" | "agent" | "merchant">("all");
  const [priorityFilter, setPriorityFilter] = useState<"" | "HIGH" | "MEDIUM" | "LOW">("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [persona, setPersona] = useState<PersonaRole>("ops_manager");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<Record<string, string>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<string, { status: string; id: string }>>({});
  const [showDataRequirements, setShowDataRequirements] = useState(false);
  const [showAllCases, setShowAllCases] = useState(false);

  // Fetch daily priorities from backend API
  const queryParams = new URLSearchParams({ limit: "40", offset: "0" });
  if (entityFilter !== "all") queryParams.set("entity_type", entityFilter);
  if (priorityFilter) queryParams.set("priority", priorityFilter);
  if (districtSearch.trim()) queryParams.set("district", districtSearch.trim());

  const resource = useApi<DailyPrioritiesResponse>(
    `/api/v1/operations/daily-priorities?${queryParams.toString()}`
  );

  const canPropose = Boolean(user && ["ADMIN", "ANALYST", "REGIONAL_MANAGER"].includes(user.role));

  const handleProposeAction = async (item: PriorityActionItem) => {
    if (!canPropose) return;
    setSubmittingId(item.entity_id);
    try {
      const payload = {
        target_type: item.entity_type,
        target_id: item.entity_id,
        capability: "daily_operations_priority",
        recommended_action: item.recommended_action,
        reason: `${item.reason}. Evidence: ${item.evidence}`,
      };
      const result = await apiFetch<{ id: string }>("/api/v1/interventions", {
        method: "POST",
        body: payload,
      });

      setLocalStatuses((prev) => ({
        ...prev,
        [item.entity_id]: { status: "PROPOSED", id: result.id },
      }));
      setSuccessFeedback((prev) => ({
        ...prev,
        [item.entity_id]: t("ops.action_sent", "Proposal created in Action Review"),
      }));
    } catch (err) {
      alert(`Could not record review proposal: ${friendlyError(err)}`);
    } finally {
      setSubmittingId(null);
    }
  };

  const briefing = resource.status === "success" ? resource.data.briefing : null;
  const items = resource.status === "success" ? resource.data.items : [];

  // Filter further by persona focus if selected
  const displayItems = items.filter((item) => {
    if (persona === "agent_manager") return item.entity_type === "agent";
    if (persona === "merchant_manager") return item.entity_type === "merchant";
    if (persona === "field_team") {
      return (
        item.recommended_action.toLowerCase().includes("visit") ||
        item.recommended_action.toLowerCase().includes("field") ||
        item.reason.toLowerCase().includes("inactivity") ||
        item.reason.toLowerCase().includes("service gap")
      );
    }
    return true; // ops_manager sees all
  });

  const visibleItems = showAllCases ? displayItems : displayItems.slice(0, 10);

  return (
    <div className="daily-operations-container" style={{ marginBottom: 32 }}>
      {/* 1. MORNING BRIEFING CARD */}
      <section className="morning-briefing-card panel" aria-label="Daily Operations Brief">
        <div className="panel-heading" style={{ borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.08))" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Clock size={12} /> 9:00 AM QUEUE
              </span>
              <p className="eyebrow" style={{ margin: 0, letterSpacing: "0.08em" }}>
                {t("ops.eyebrow", "DAILY MFS OPERATIONS DECISION SYSTEM")}
              </p>
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "2px 0 6px" }}>
              {t("ops.brief_title", "GOOD MORNING — DAILY MFS OPERATIONS BRIEF")}
            </h2>
            <p className="muted text-small" style={{ margin: 0 }}>
              {t("ops.target_users", "Target Users: MFS Operations Manager · Agent Operations Manager · Merchant Operations Manager · Field Team")}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="badge badge-neutral" style={{ fontSize: "0.78rem" }}>
              As of {briefing?.as_of_date ?? "2026-09-30"}
            </span>
          </div>
        </div>

        <div className="panel-body">
          {/* Briefing summary text */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <ShieldAlert size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--text-main, #fff)" }}>
                  {language === "bn"
                    ? briefing?.briefing_text_bn ?? "আজকের অপারেশনাল সারসংক্ষেপ লোড হচ্ছে..."
                    : briefing?.briefing_text_en ?? "Today's operational decision summary loading..."}
                </strong>
                <p className="muted text-small" style={{ margin: "6px 0 0" }}>
                  {language === "bn" ? "শীর্ষ কার্যক্রম: " : "Top operational action today: "}
                  <span style={{ color: "#f59e0b" }}>{briefing?.top_recommended_action ?? "—"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="hero-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#ef4444" }}>
                <ShieldAlert size={14} /> {t("ops.high_priority", "High Priority")}
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#ef4444" }}>
                <CountDisplay value={briefing?.high_priority_count ?? 0} />
              </div>
              <div className="metric-foot">Demands immediate action</div>
            </div>

            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#38bdf8" }}>
                <UsersRound size={14} /> Agent Liquidity Cases
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#38bdf8" }}>
                <CountDisplay value={briefing?.agent_cases_count ?? 0} />
              </div>
              <div className="metric-foot">Float / peak cash-out focus</div>
            </div>

            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#f59e0b" }}>
                <Building2 size={14} /> Merchant Inactivity Cases
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#f59e0b" }}>
                <CountDisplay value={briefing?.merchant_cases_count ?? 0} />
              </div>
              <div className="metric-foot">Retention / peer gap focus</div>
            </div>

            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label">
                <TrendingUp size={14} /> Total Flagged Queue
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem" }}>
                <CountDisplay value={briefing?.total_actions_flagged ?? 0} />
              </div>
              <div className="metric-foot">Ranked deterministically</div>
            </div>
          </div>

          {/* Operational Persona Switcher */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              paddingTop: 12,
              borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            }}
          >
            <span className="text-small muted" style={{ fontWeight: 600 }}>
              {language === "bn" ? "অপারেশনাল ভূমিকা:" : "Operations Persona View:"}
            </span>
            <button
              className={`button button-small ${persona === "ops_manager" ? "button-primary" : ""}`}
              onClick={() => setPersona("ops_manager")}
            >
              MFS Operations Manager (All)
            </button>
            <button
              className={`button button-small ${persona === "agent_manager" ? "button-primary" : ""}`}
              onClick={() => setPersona("agent_manager")}
            >
              Agent Operations Manager
            </button>
            <button
              className={`button button-small ${persona === "merchant_manager" ? "button-primary" : ""}`}
              onClick={() => setPersona("merchant_manager")}
            >
              Merchant Operations Manager
            </button>
            <button
              className={`button button-small ${persona === "field_team" ? "button-primary" : ""}`}
              onClick={() => setPersona("field_team")}
            >
              Field Team / TM (Visits)
            </button>
          </div>
        </div>
      </section>

      {/* 2. SYNTHETIC EXAMPLE PROBLEM STORY CARD */}
      <section
        className="synthetic-story-card panel"
        style={{
          marginTop: 16,
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)",
          border: "1px dashed rgba(245, 158, 11, 0.4)",
        }}
      >
        <div className="panel-body" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f59e0b",
                flexShrink: 0,
              }}
            >
              <Zap size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <span className="badge badge-warning" style={{ fontWeight: 700, fontSize: "0.72rem" }}>
                  {t("ops.synthetic_example_badge", "SYNTHETIC EXAMPLE")}
                </span>
                <strong style={{ fontSize: "0.95rem" }}>
                  {t("ops.synthetic_example_title", "Daily Operations Scenario: Pre-Peak Liquidity Rebalancing")}
                </strong>
              </div>
              <p className="muted text-small" style={{ lineHeight: 1.55, margin: "4px 0 6px" }}>
                {t(
                  "ops.synthetic_example_desc",
                  "An agent shows rising cash-out demand before a peak period while the liquidity stress indicator is high. Without early attention, customers may face failed cash-out service. The Command Center flags the agent before the peak window and recommends liquidity support for human review."
                )}
              </p>
              <small className="muted" style={{ fontStyle: "italic", fontSize: "0.74rem" }}>
                {t(
                  "ops.synthetic_example_disclaimer",
                  "This is a synthetic operational illustration for demonstration, not a real Upay incident."
                )}
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TODAY'S PRIORITY ACTIONS (MAIN QUEUE) */}
      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading" style={{ flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#ef4444" }}>●</span>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0 }}>
                {showAllCases
                  ? t("ops.priority_actions", "TODAY’S PRIORITY ACTIONS")
                  : t("ops.top_10_actions", "TODAY’S TOP 10 ACTIONS")}
              </h2>
            </div>
            <p className="muted text-small" style={{ margin: "4px 0 0" }}>
              {showAllCases
                ? t(
                    "ops.priority_actions_sub",
                    "Full ranked operational queue combining agent liquidity pressure, forward merchant hazard, and service gap signals."
                  )
                : t(
                    "ops.top_10_sub",
                    `Focused top 10 decisions for morning operations review (showing 10 of ${displayItems.length} flagged cases).`
                  )}
            </p>
          </div>

          {/* Queue Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="status-tabs" style={{ margin: 0 }}>
              <button
                className={`status-tab ${entityFilter === "all" ? "active" : ""}`}
                onClick={() => setEntityFilter("all")}
              >
                {t("ops.all_entities", "All Entities")}
              </button>
              <button
                className={`status-tab ${entityFilter === "agent" ? "active" : ""}`}
                onClick={() => setEntityFilter("agent")}
              >
                {t("ops.agents_only", "Agents Only")}
              </button>
              <button
                className={`status-tab ${entityFilter === "merchant" ? "active" : ""}`}
                onClick={() => setEntityFilter("merchant")}
              >
                {t("ops.merchants_only", "Merchants Only")}
              </button>
            </div>

            <div className="status-tabs" style={{ margin: 0 }}>
              <button
                className={`status-tab ${!priorityFilter ? "active" : ""}`}
                onClick={() => setPriorityFilter("")}
              >
                {t("ops.all_priorities", "All")}
              </button>
              <button
                className={`status-tab ${priorityFilter === "HIGH" ? "active" : ""}`}
                onClick={() => setPriorityFilter("HIGH")}
              >
                HIGH
              </button>
              <button
                className={`status-tab ${priorityFilter === "MEDIUM" ? "active" : ""}`}
                onClick={() => setPriorityFilter("MEDIUM")}
              >
                MEDIUM
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                className="input"
                style={{ padding: "6px 12px 6px 30px", fontSize: "0.82rem", borderRadius: "6px", width: 170 }}
                placeholder={t("ops.filter_district", "Filter district...")}
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>
          </div>
        </div>

        {/* Queue Items */}
        {resource.status === "loading" && <LoadingState label="Computing daily prioritized decision queue..." />}
        {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
        {resource.status === "success" && displayItems.length === 0 && (
          <EmptyState
            title={t("ops.queue_clear", "Operations Queue Clear")}
            detail={t("ops.queue_clear_detail", "No priority operational actions match the selected filter.")}
          />
        )}

        {resource.status === "success" && visibleItems.length > 0 && (
          <div className="priority-action-list" style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px" }}>
            {visibleItems.map((item) => {
              const localState = localStatuses[item.entity_id];
              const effectiveStatus = localState?.status ?? item.review_status ?? "PENDING_REVIEW";
              const isSubmitting = submittingId === item.entity_id;
              const hasIntervention = Boolean(localState?.id ?? item.intervention_id);

              return (
                <article
                  key={`${item.entity_type}-${item.entity_id}`}
                  className="priority-card"
                  style={{
                    borderRadius: "10px",
                    border: item.priority_level === "HIGH"
                      ? "1px solid rgba(239, 68, 68, 0.35)"
                      : item.priority_level === "MEDIUM"
                        ? "1px solid rgba(245, 158, 11, 0.25)"
                        : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    background: item.priority_level === "HIGH"
                      ? "linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, rgba(15, 23, 42, 0.3) 100%)"
                      : "rgba(15, 23, 42, 0.2)",
                    padding: "16px 20px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      paddingBottom: 12,
                      borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: item.priority_level === "HIGH" ? "#ef4444" : "#f59e0b",
                          color: "#fff",
                        }}
                      >
                        #{item.priority_rank}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {item.entity_type === "agent" ? (
                          <UserCheck size={16} style={{ color: "#38bdf8" }} />
                        ) : (
                          <Building2 size={16} style={{ color: "#a855f7" }} />
                        )}
                        <Link
                          href={item.entity_type === "agent" ? `/agents/${item.entity_id}` : `/merchants/${item.entity_id}`}
                          style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-main, #fff)" }}
                        >
                          {item.entity_id}
                        </Link>
                        <span className="muted text-small">· {item.entity_name_or_category}</span>
                        <span className="muted text-small">· 📍 {item.district}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <RiskBadge value={item.priority_level} />
                      <span className="badge badge-neutral" style={{ fontSize: "0.74rem" }}>
                        Score: {item.priority_score}
                      </span>
                      {effectiveStatus !== "PENDING_REVIEW" ? (
                        <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Check size={12} /> {effectiveStatus}
                        </span>
                      ) : (
                        <span className="badge badge-review" style={{ fontSize: "0.72rem" }}>
                          {t("ops.pending_review", "Pending Review")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16,
                      padding: "14px 0",
                    }}
                  >
                    <div>
                      <small className="muted" style={{ display: "block", marginBottom: 3, fontWeight: 600 }}>
                        {t("ops.why_flagged", "Why Flagged")}
                      </small>
                      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-main, #fff)", fontSize: "0.92rem" }}>
                        {item.reason}
                      </p>
                      <small className="muted" style={{ display: "block", marginTop: 6, fontSize: "0.8rem" }}>
                        <strong>{t("ops.evidence", "Evidence / Signal")}:</strong> {item.evidence}
                      </small>
                    </div>

                    <div>
                      <small className="muted" style={{ display: "block", marginBottom: 3, fontWeight: 600 }}>
                        {t("ops.recommended_action", "Recommended Action")}
                      </small>
                      <p style={{ margin: 0, fontWeight: 600, color: "#f59e0b", fontSize: "0.92rem" }}>
                        {item.recommended_action}
                      </p>
                      <small className="muted" style={{ display: "block", marginTop: 6, fontSize: "0.8rem" }}>
                        <strong>{t("ops.expected_value", "Expected Business Impact")}:</strong>{" "}
                        <span style={{ color: "#10b981" }}>{item.expected_value_label}</span>
                      </small>
                    </div>
                  </div>

                  {/* Metadata & Actions Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      paddingTop: 12,
                      borderTop: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span className="muted">
                        Sources: <strong>{item.source_modules.join(", ")}</strong>
                      </span>
                      <span className="muted">· {item.confidence_label}</span>
                      {item.future_data_required?.length > 0 && (
                        <span
                          className="badge badge-neutral"
                          title={`Future production data: ${item.future_data_required.join(", ")}`}
                          style={{ fontSize: "0.7rem", opacity: 0.85 }}
                        >
                          Future data required: {item.future_data_required[0]}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {successFeedback[item.entity_id] && (
                        <span style={{ color: "#10b981", fontSize: "0.78rem", fontWeight: 600 }}>
                          ✓ {successFeedback[item.entity_id]}
                        </span>
                      )}

                      {hasIntervention ? (
                        <Link
                          href="/interventions"
                          className="button button-small button-gold"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <CheckCircle2 size={13} /> {t("ops.open_interventions_link", "Open in Action Review")}
                        </Link>
                      ) : canPropose ? (
                        <button
                          className="button button-small button-gold"
                          disabled={isSubmitting}
                          onClick={() => handleProposeAction(item)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Zap size={13} /> {isSubmitting ? "Submitting…" : t("ops.review_action", "Review Action")}
                        </button>
                      ) : (
                        <Link
                          href={`/interventions?target_type=${item.entity_type}&target_id=${item.entity_id}`}
                          className="button button-small"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          {t("ops.review_action", "Review Action")} <ArrowRight size={13} />
                        </Link>
                      )}

                      <Link
                        href={item.entity_type === "agent" ? `/agents/${item.entity_id}` : `/merchants/${item.entity_id}`}
                        className="button button-small"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        title="View Full Profile"
                      >
                        Profile <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
            {displayItems.length > 10 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: 12,
                  borderTop: "1px dashed var(--border-subtle, rgba(255, 255, 255, 0.1))",
                }}
              >
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowAllCases((prev) => !prev)}
                  style={{
                    padding: "8px 24px",
                    fontSize: "0.86rem",
                    fontWeight: 600,
                    borderRadius: "8px",
                  }}
                >
                  {showAllCases
                    ? t("ops.show_top_10", "← Show Top 10 Only")
                    : t("ops.view_all_flagged", `View all ${displayItems.length} flagged cases →`)}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="panel-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="muted text-small">
            {language === "bn"
              ? "অগ্রাধিকার স্কোর স্বচ্ছ নিয়মের ভিত্তিতে নির্ধারিত, কোনো কৃত্রিম এমএল সম্ভাব্যতা নয়।"
              : "Priority scoring is deterministic and explainable: (0.45 × Severity + 0.35 × Urgency + 0.20 × Confidence) × 100."}
          </span>
          <button
            className="text-button text-small"
            onClick={() => setShowDataRequirements(!showDataRequirements)}
          >
            {showDataRequirements ? "Hide Data Requirements" : "What Data We Need in Production →"}
          </button>
        </div>
      </section>

      {/* 4. WHAT DATA WE WOULD NEED IN PRODUCTION PANEL */}
      {showDataRequirements && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SYSTEM ARCHITECTURE</p>
              <h2>{t("ops.production_data_title", "What Data We Would Need in Production")}</h2>
              <p className="muted text-small">
                {t(
                  "ops.production_data_sub",
                  "Explicit architectural distinction between Current Synthetic Data and Production Upay Data Requirements."
                )}
              </p>
            </div>
            <span className="badge badge-neutral">Production Upay Readiness</span>
          </div>

          <div className="panel-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data Domain</th>
                    <th>
                      <span className="badge badge-warning">CURRENT SYNTHETIC DATA</span>
                    </th>
                    <th>
                      <span className="badge badge-success">PRODUCTION UPAY DATA REQUIRED</span>
                    </th>
                    <th>Operational Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Agent Live Float Balance</strong>
                    </td>
                    <td>Batch capacity proxy (liquidity_limit) only; static snapshot</td>
                    <td>Real-time core banking / MFS ledger balance stream per agent wallet</td>
                    <td>Prevent intraday cash-out stockouts & trigger automatic rebalancing</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Cash-In / Cash-Out Stream</strong>
                    </td>
                    <td>7d/30d/90d historical aggregate averages</td>
                    <td>Sub-minute transaction events with fee breakdown</td>
                    <td>Detect instant liquidity spikes and localized cash drains</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Failed Transaction Events</strong>
                    </td>
                    <td>Inferred indirectly via service_gap_flag</td>
                    <td>Real-time error logs (Insufficient Float, Timeout, Network Failure)</td>
                    <td>Immediate float dispatch before customer churns to competitor</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Merchant QR & Channel Logs</strong>
                    </td>
                    <td>Binary flags (qr_enabled, app_enabled) without scan timestamps</td>
                    <td>Live Bangla QR scan events & merchant app session logs</td>
                    <td>Target inactive QR merchants for field activation & POS replacement</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Field-Visit & CRM Logs</strong>
                    </td>
                    <td>Future data required (not present in synthetic dataset)</td>
                    <td>Territory Officer (TO) GPS check-ins & merchant resolution notes</td>
                    <td>Track closed-loop resolution of interventions and officer SLA</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Real GPS & Outlet Geography</strong>
                    </td>
                    <td>Categorical district / area_type only; no coordinates</td>
                    <td>Verified outlet coordinates (lat/long) where permitted</td>
                    <td>Spatial routing for cash distribution vans & route optimization</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Holiday & Eid Event Calendar</strong>
                    </td>
                    <td>Standard calendar dates without festival overlays</td>
                    <td>National MFS calendar: Eid-ul-Fitr, Eid-ul-Adha, Pohela Boishakh</td>
                    <td>Pre-position liquidity buffers 72 hours before remittance peaks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
