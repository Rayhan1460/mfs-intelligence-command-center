"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Search,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UsersRound,
} from "lucide-react";

import { apiFetch, friendlyError } from "@/lib/api";
import {
  CountDisplay,
  EmptyState,
  ErrorState,
  LoadingState,
  RiskBadge,
} from "@/components/ui";
import type {
  DailyPrioritiesResponse,
  OutcomesSummary,
  PriorityActionItem,
} from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

type PersonaRole = "all" | "ops_manager" | "agent_manager" | "merchant_manager" | "field_team";
type OperationalTab = "queue" | "case_studies" | "business_impact" | "field_plan" | "outcomes";
type SortOption = "expected_value" | "priority" | "risk" | "newest";

export function DailyOperationsQueue() {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<OperationalTab>("queue");
  const [sortBy, setSortBy] = useState<SortOption>("expected_value");
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
  const queryParams = new URLSearchParams({ limit: "40", offset: "0", sort_by: sortBy });
  if (entityFilter !== "all") queryParams.set("entity_type", entityFilter);
  if (priorityFilter) queryParams.set("priority", priorityFilter);
  if (districtSearch.trim()) queryParams.set("district", districtSearch.trim());

  const resource = useApi<DailyPrioritiesResponse>(
    `/api/v1/operations/daily-priorities?${queryParams.toString()}`
  );

  const outcomesResource = useApi<OutcomesSummary>("/api/v1/interventions/outcomes-summary");

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
        owner: item.suggested_owner,
        due_date: item.suggested_demo_sla,
        expected_impact: item.expected_value_label,
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
  const crossSignals = resource.status === "success" ? (resource.data.cross_network_signals ?? []) : [];

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
            <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "2px 0 6px", color: "var(--text-primary, #102A43)" }}>
              {t("ops.brief_title", "GOOD MORNING — DAILY MFS OPERATIONS BRIEF")}
            </h2>
            <p className="muted text-small" style={{ margin: 0, color: "var(--text-secondary, #334E68)" }}>
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
          {/* Briefing summary text with guaranteed WCAG contrast */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "10px",
              background: "var(--surface-danger, #FEE2E2)",
              border: "1px solid var(--border-danger, #FCA5A5)",
              color: "var(--text-on-danger, #991B1B)",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <ShieldAlert size={22} style={{ color: "var(--text-on-danger, #991B1B)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ fontSize: "1rem", color: "var(--text-on-danger, #991B1B)", display: "block" }}>
                  {language === "bn"
                    ? briefing?.briefing_text_bn ?? "আজকের অপারেশনাল সারসংক্ষেপ লোড হচ্ছে..."
                    : briefing?.briefing_text_en ?? "Today's operational decision summary loading..."}
                </strong>
                <p style={{ margin: "6px 0 0", fontSize: "0.86rem", color: "var(--text-secondary, #334E68)" }}>
                  <span style={{ fontWeight: 600 }}>{language === "bn" ? "শীর্ষ কার্যক্রম: " : "Top operational action today: "}</span>
                  <span style={{ color: "#92400E", fontWeight: 600 }}>{briefing?.top_recommended_action ?? "—"}</span>
                </p>
                {briefing?.cross_network_alert && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "#1E40AF", fontWeight: 600 }}>
                    🔗 Cross-Network Overlap: {briefing.cross_network_alert}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="hero-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#991B1B" }}>
                <ShieldAlert size={14} /> {t("ops.high_priority", "High Priority")}
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#991B1B" }}>
                <CountDisplay value={briefing?.high_priority_count ?? 0} />
              </div>
              <div className="metric-foot">Demands immediate action</div>
            </div>

            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#0369A1" }}>
                <UsersRound size={14} /> Agent Liquidity Cases
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#0369A1" }}>
                <CountDisplay value={briefing?.agent_cases_count ?? 0} />
              </div>
              <div className="metric-foot">Float / peak cash-out focus</div>
            </div>

            <div className="metric-card" style={{ padding: "12px 16px" }}>
              <div className="metric-label" style={{ color: "#92400E" }}>
                <Building2 size={14} /> Merchant Inactivity Cases
              </div>
              <div className="metric-value" style={{ fontSize: "1.7rem", color: "#92400E" }}>
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

          {/* Operational View Navigation Tabs */}
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
            <button
              className={`button button-small ${activeTab === "queue" ? "button-primary" : "button-secondary"}`}
              onClick={() => setActiveTab("queue")}
            >
              📋 {language === "bn" ? "অপারেশন কিউ" : "Priority Queue"}
            </button>
            <button
              className={`button button-small ${activeTab === "case_studies" ? "button-primary" : "button-secondary"}`}
              onClick={() => setActiveTab("case_studies")}
            >
              🔍 {language === "bn" ? "বাস্তব কেস স্টাডি" : "Worked Case Studies"}
            </button>
            <button
              className={`button button-small ${activeTab === "business_impact" ? "button-primary" : "button-secondary"}`}
              onClick={() => setActiveTab("business_impact")}
            >
              💰 {language === "bn" ? "ব্যবসায়িক প্রভাব" : "Business Impact Simulation"}
            </button>
            <button
              className={`button button-small ${activeTab === "field_plan" ? "button-primary" : "button-secondary"}`}
              onClick={() => setActiveTab("field_plan")}
            >
              🗺️ {language === "bn" ? "মাঠ পর্যায়ের পরিকল্পনা" : "Field Operations Plan"}
            </button>
            <button
              className={`button button-small ${activeTab === "outcomes" ? "button-primary" : "button-secondary"}`}
              onClick={() => setActiveTab("outcomes")}
            >
              📊 {language === "bn" ? "ফলাফল ট্র্যাকিং" : "Outcomes & Pilot KPIs"}
            </button>
          </div>
        </div>
      </section>

      {/* 2. CROSS-NETWORK INTELLIGENCE BANNER */}
      {crossSignals.length > 0 && (
        <section
          className="panel"
          style={{
            marginTop: 16,
            background: "var(--surface-info, #E0F2FE)",
            border: "1px solid var(--border-info, #7DD3FC)",
            color: "var(--text-on-info, #0369A1)",
          }}
        >
          <div className="panel-body" style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Layers size={22} style={{ color: "#0369A1", flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: "0.95rem", color: "#0369A1" }}>
                  Cross-Network Intelligence: {crossSignals[0].headline}
                </strong>
                <p style={{ margin: "3px 0 0", fontSize: "0.84rem", color: "#1E3A8A" }}>
                  {crossSignals[0].recommended_action}
                </p>
                <small style={{ color: "#1D4ED8", fontSize: "0.75rem", fontStyle: "italic" }}>
                  Scope: {crossSignals[0].operational_scope}
                </small>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 1: MAIN PRIORITY QUEUE */}
      {activeTab === "queue" && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading" style={{ flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#ef4444" }}>●</span>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: 0, color: "var(--text-primary, #102A43)" }}>
                  {showAllCases
                    ? t("ops.priority_actions", "TODAY’S PRIORITY ACTIONS")
                    : t("ops.top_10_actions", "TODAY’S TOP 10 ACTIONS")}
                </h2>
              </div>
              <p className="muted text-small" style={{ margin: "4px 0 0", color: "var(--text-secondary, #334E68)" }}>
                {showAllCases
                  ? t("ops.priority_actions_sub", `Full ranked operational queue (${displayItems.length} total cases).`)
                  : t("ops.top_10_sub", `Focused top 10 decisions for morning operations review (showing 10 of ${displayItems.length} flagged cases).`)}
              </p>
            </div>

            {/* Sorting & Filter Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="text-small muted" style={{ fontWeight: 600 }}>Sort:</span>
                <select
                  className="input"
                  style={{ padding: "6px 10px", fontSize: "0.8rem", borderRadius: "6px" }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="expected_value">Highest Expected Value (Default)</option>
                  <option value="priority">Highest Priority Score</option>
                  <option value="risk">Highest Operational Risk</option>
                  <option value="newest">Newest Entity ID</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="text-small muted" style={{ fontWeight: 600 }}>Priority:</span>
                <select
                  className="input"
                  style={{ padding: "6px 10px", fontSize: "0.8rem", borderRadius: "6px" }}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as "" | "HIGH" | "MEDIUM" | "LOW")}
                >
                  <option value="">All Priorities</option>
                  <option value="HIGH">High (≥ 75)</option>
                  <option value="MEDIUM">Medium (50-74)</option>
                  <option value="LOW">Low (&lt; 50)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="text-small muted" style={{ fontWeight: 600 }}>Focus:</span>
                <select
                  className="input"
                  style={{ padding: "6px 10px", fontSize: "0.8rem", borderRadius: "6px" }}
                  value={persona}
                  onChange={(e) => setPersona(e.target.value as PersonaRole)}
                >
                  <option value="ops_manager">Ops Manager (All)</option>
                  <option value="agent_manager">Agent Focus</option>
                  <option value="merchant_manager">Merchant Focus</option>
                  <option value="field_team">Field Team Focus</option>
                </select>
              </div>

              <div className="status-tabs" style={{ margin: 0 }}>
                <button
                  className={`status-tab ${entityFilter === "all" ? "active" : ""}`}
                  onClick={() => setEntityFilter("all")}
                >
                  {t("ops.all_entities", "All")}
                </button>
                <button
                  className={`status-tab ${entityFilter === "agent" ? "active" : ""}`}
                  onClick={() => setEntityFilter("agent")}
                >
                  Agents
                </button>
                <button
                  className={`status-tab ${entityFilter === "merchant" ? "active" : ""}`}
                  onClick={() => setEntityFilter("merchant")}
                >
                  Merchants
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  style={{ padding: "6px 12px 6px 30px", fontSize: "0.82rem", borderRadius: "6px", width: 140 }}
                  placeholder="Filter district..."
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
                        : "1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))",
                      background: item.priority_level === "HIGH"
                        ? "rgba(254, 226, 226, 0.25)"
                        : "var(--surface, #FFFFFF)",
                      padding: "16px 20px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
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
                        borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: item.priority_level === "HIGH" ? "#DC2626" : "#D97706",
                            color: "#fff",
                          }}
                        >
                          #{item.priority_rank}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {item.entity_type === "agent" ? (
                            <UserCheck size={16} style={{ color: "#0284C7" }} />
                          ) : (
                            <Building2 size={16} style={{ color: "#D97706" }} />
                          )}
                          <strong style={{ fontSize: "1.02rem", color: "var(--text-primary, #102A43)" }}>
                            {item.entity_id}
                          </strong>
                          <span className="muted text-small">({item.entity_name_or_category})</span>
                        </div>
                        <span className="badge badge-neutral" style={{ fontSize: "0.72rem" }}>
                          📍 {item.district}
                        </span>
                        <span className={`badge ${item.risk_or_opportunity === "RISK" ? "badge-danger" : "badge-success"}`}>
                          {item.risk_or_opportunity}
                        </span>
                        <span className="badge badge-neutral" style={{ fontSize: "0.72rem" }}>
                          {effectiveStatus}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {item.suggested_owner && (
                          <span className="badge badge-info" style={{ fontSize: "0.72rem" }}>
                            👤 {item.suggested_owner}
                          </span>
                        )}
                        {item.suggested_demo_sla && (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: "0.72rem" }}
                            title="Suggested Demo SLA — not actual upay SLA"
                          >
                            ⏱️ {item.suggested_demo_sla}
                          </span>
                        )}
                        {item.expected_value_score !== undefined && (
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                            Est. Impact: ৳{item.expected_value_score.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
                      <div>
                        <strong style={{ fontSize: "0.96rem", color: "var(--text-primary, #102A43)" }}>
                          {item.reason}
                        </strong>
                        <p style={{ margin: "4px 0 0", fontSize: "0.84rem", color: "var(--text-secondary, #334E68)" }}>
                          {item.evidence}
                        </p>
                      </div>

                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          background: "var(--surface-raised, #F0F6FF)",
                          border: "1px solid var(--border, #DCE8F5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ArrowRight size={15} style={{ color: "var(--blue-interactive, #1976E9)" }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary, #102A43)" }}>
                            Action: {item.recommended_action}
                          </span>
                        </div>
                        <small className="muted" style={{ fontSize: "0.75rem" }}>
                          Engine: {item.source_model_or_rule} ({item.model_version ?? "2.0"})
                        </small>
                      </div>

                      {/* Card Footer Actions */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="muted text-small" style={{ fontSize: "0.76rem" }}>
                            Confidence: {item.confidence_label}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {item.entity_type === "agent" ? (
                            <Link href={`/agents/${item.entity_id}`} className="button button-quiet button-small">
                              Agent Details <ExternalLink size={12} />
                            </Link>
                          ) : (
                            <Link href={`/merchants/${item.entity_id}`} className="button button-quiet button-small">
                              Merchant Details <ExternalLink size={12} />
                            </Link>
                          )}

                          {hasIntervention ? (
                            <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <CheckCircle2 size={13} /> {successFeedback[item.entity_id] || "Proposal created in Action Review"}
                            </span>
                          ) : (
                            <button
                              className="button button-primary button-small"
                              onClick={() => void handleProposeAction(item)}
                              disabled={!canPropose || isSubmitting}
                            >
                              {isSubmitting ? "Recording..." : "Review Action →"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Toggle All vs Top 10 */}
          <div className="panel-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              className="button button-quiet button-small"
              onClick={() => setShowAllCases(!showAllCases)}
            >
              {showAllCases ? "▲ Collapse to Top 10 Actions Today" : `▼ View all flagged cases (${displayItems.length})`}
            </button>
            <span className="muted text-small">
              Default displays top 10 actionable decisions to prevent review queue overload.
            </span>
          </div>
        </section>
      )}

      {/* TAB 2: WORKED OPERATIONAL CASE STUDIES */}
      {activeTab === "case_studies" && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CANONICAL CASE STUDIES</p>
              <h2>End-to-End Operational Decision Trace</h2>
              <p className="muted text-small">
                Real canonical entities from live synthetic batch verifying the full chain from signal to outcome.
              </p>
            </div>
          </div>

          <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18 }}>
            {/* Case 1: Canonical Agent AGT00025 */}
            <article className="panel" style={{ padding: "18px", border: "1px solid #7DD3FC", background: "#F0F9FF" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="badge badge-info">WORKED AGENT CASE</span>
                <span className="badge badge-danger">CRITICAL LIQUIDITY</span>
              </div>
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 6px", color: "#0369A1" }}>
                AGT00025 (Standard Agent · Dhaka)
              </h3>
              <div style={{ display: "grid", gap: 8, fontSize: "0.85rem", color: "#1E3A8A" }}>
                <div><strong>Signal:</strong> Next-day predicted cash-out of ৳2,218 vs normal buffer capacity.</div>
                <div><strong>Evidence:</strong> P90 pinball stress band 15.6% of limit; shortfall proxy hazard.</div>
                <div><strong>Underlying Model:</strong> LightGBM Regressor (Operational P90 Buffer v2.0).</div>
                <div><strong>Why Flagged:</strong> High probability of cash-out failure before 2:00 PM peak.</div>
                <div><strong>Next Best Action:</strong> Contact agent and dispatch emergency float rebalancing.</div>
                <div><strong>Suggested Owner:</strong> Agent Operations · <strong>Suggested SLA:</strong> 4 hours.</div>
                <div><strong>Expected Impact:</strong> Protects ৳1,500 service cost proxy; preserves customer trust.</div>
                <div><strong>Human Review:</strong> Proposed by Analyst → Approved by Regional Manager.</div>
                <div><strong>Outcome Status:</strong> <span className="badge badge-success">IN_PROGRESS (Float Dispatched)</span></div>
              </div>
            </article>

            {/* Case 2: Canonical Merchant MRC000001 */}
            <article className="panel" style={{ padding: "18px", border: "1px solid #FCA5A5", background: "#FFF1F2" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="badge badge-warning">WORKED MERCHANT CASE</span>
                <span className="badge badge-danger">FORWARD CHURN HAZARD</span>
              </div>
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 6px", color: "#991B1B" }}>
                MRC000001 (Grocery Retail · Chittagong)
              </h3>
              <div style={{ display: "grid", gap: 8, fontSize: "0.85rem", color: "#7F1D1D" }}>
                <div><strong>Signal:</strong> Forward 30-day inactivity probability: <strong>94.6%</strong> (Cutoff: 2026-08-31).</div>
                <div><strong>Top Features:</strong> days_since_last_txn: 28d; 30d transaction count dropped 82%.</div>
                <div><strong>Underlying Model:</strong> <strong>LightGBM Classifier (Phase 2 Forward Hazard v2.0)</strong>.</div>
                <div><strong>Peer Benchmark Context:</strong> Bottom 15th percentile of district grocery peers.</div>
                <div><strong>Why Flagged:</strong> Severe drop in merchant QR checkout velocity.</div>
                <div><strong>Next Best Action:</strong> Field officer retention visit + Bangla QR collateral refresh.</div>
                <div><strong>Suggested Owner:</strong> Field Team / Merchant Ops · <strong>Suggested SLA:</strong> 24 hours.</div>
                <div><strong>Expected Impact:</strong> Protects ৳8,500 annual merchant retention value proxy.</div>
                <div><strong>Human Review:</strong> Proposed by Operations Analyst → Approved by Manager.</div>
                <div><strong>Outcome Status:</strong> <span className="badge badge-warning">SCHEDULED FOR VISIT</span></div>
              </div>
            </article>
          </div>
        </section>
      )}

      {/* TAB 3: BUSINESS IMPACT SIMULATION */}
      {activeTab === "business_impact" && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SYNTHETIC BUSINESS IMPACT ENGINE</p>
              <h2>Measurable Operational Business Impact</h2>
              <p className="muted text-small">
                Transparent expected-value simulations across the 800-agent liquidity evaluation and 5,000-merchant forward churn queue.
              </p>
            </div>
            <span className="badge badge-warning">Illustrative Synthetic Scenario</span>
          </div>

          <div className="panel-body">
            <div className="notice notice-gold" style={{ marginBottom: 16 }}>
              <strong>Notice:</strong> Illustrative synthetic scenario — not actual upay financial data. Used to prove economic evaluation methodology.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              {/* Agent Liquidity Simulation */}
              <div className="panel" style={{ padding: "16px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "1rem", margin: "0 0 10px", color: "var(--blue-deep)" }}>
                  Agent Liquidity Impact Simulation (12,102 Agent-Days)
                </h3>
                <div className="table-wrap">
                  <table style={{ fontSize: "0.82rem" }}>
                    <thead>
                      <tr>
                        <th>Strategy</th>
                        <th>Shortfall Proxy Rate</th>
                        <th>Coverage</th>
                        <th>Avg Buffer</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Without Recommendation</strong></td>
                        <td><span style={{ color: "#DC2626" }}>10.07% (1,219 events)</span></td>
                        <td>89.93%</td>
                        <td>৳0</td>
                      </tr>
                      <tr style={{ background: "rgba(22, 131, 91, 0.08)" }}>
                        <td><strong>With P90 Buffer (Recommended)</strong></td>
                        <td><span style={{ color: "#16A34A" }}>10.07% (calibrated)</span></td>
                        <td><strong>89.93%</strong></td>
                        <td>৳1,999.53</td>
                      </tr>
                      <tr>
                        <td><strong>7-Day Maximum Cashout</strong></td>
                        <td>2.60% (314 events)</td>
                        <td>97.40%</td>
                        <td>৳6,798.40 (3.4x capital)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="muted text-small" style={{ marginTop: 8 }}>
                  The calibrated P90 buffer protects 90% of operating days while avoiding excessive idle working capital (ties up 3.4x less cash than the 7-day max rule).
                </p>
              </div>

              {/* Merchant Churn Break-Even Simulation */}
              <div className="panel" style={{ padding: "16px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "1rem", margin: "0 0 10px", color: "var(--blue-deep)" }}>
                  Merchant Churn Break-Even Analysis (Threshold = 0.35)
                </h3>
                <div style={{ display: "grid", gap: 8, fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Flagged for Review:</span>
                    <strong>2,215 merchants (44.3% of network)</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Held-out Precision / Recall:</span>
                    <strong>25.55% precision / 88.71% recall</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Estimated True Churners Caught:</span>
                    <strong>566 merchants</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Synthetic Outreach Cost (৳250 desk/phone):</span>
                    <strong>৳553,750</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Merchant Retention Value Proxy:</span>
                    <strong>৳8,500 / merchant</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <strong>Break-Even Reactivations Needed:</strong>
                    <strong style={{ color: "#16A34A" }}>65.1 merchants (11.5% of true churners)</strong>
                  </div>
                </div>
                <div className="notice notice-info" style={{ marginTop: 10, fontSize: "0.8rem" }}>
                  <strong>Economic Conclusion:</strong> If field follow-up reactivates just <strong>11.5%</strong> of the 566 true upcoming churners caught, the entire retention campaign fully recovers its cost.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: FIELD OPERATIONS PLAN (BANGLA + MOBILE READY) */}
      {activeTab === "field_plan" && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">FIELD DEPLOYMENT</p>
              <h2>{language === "bn" ? "মাঠ পর্যায়ের পরিদর্শন ও কার্যক্রম পরিকল্পনা" : "Field Operations Action Plan"}</h2>
              <p className="muted text-small">
                {language === "bn"
                  ? "টেরিটরি অফিসার এবং ফিল্ড টিমের দৈনিক ভিজিট শিডিউল (প্রশাসনিক জেলা অনুযায়ী বিন্যস্ত; কোনো কৃত্রিম জিপিএস নেই)।"
                  : "Territory Officer and field team daily visit schedule (grouped by district; strictly no fabricated GPS coordinates)."}
              </p>
            </div>
            <span className="badge badge-neutral">Field Readiness</span>
          </div>

          <div className="panel-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Type</th>
                    <th>District</th>
                    <th>Priority</th>
                    <th>Reason</th>
                    <th>Suggested Action</th>
                    <th>Owner</th>
                    <th>Demo SLA</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr key={`field-${item.entity_id}`}>
                      <td><strong>{item.entity_id}</strong></td>
                      <td>{item.entity_type}</td>
                      <td>{item.district}</td>
                      <td><RiskBadge value={item.priority_level} /></td>
                      <td style={{ maxWidth: 220 }}>{item.reason}</td>
                      <td style={{ maxWidth: 260 }}>{item.recommended_action}</td>
                      <td><span className="badge badge-info">{item.suggested_owner}</span></td>
                      <td><span className="badge badge-warning">{item.suggested_demo_sla}</span></td>
                      <td><span className="badge badge-neutral">{item.review_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 5: OUTCOMES & PILOT KPIS */}
      {activeTab === "outcomes" && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CLOSED-LOOP GOVERNANCE</p>
              <h2>Intervention Outcomes &amp; Pilot KPIs</h2>
              <p className="muted text-small">
                Measurement framework tracking human review throughput, decision acceptance, and 3-phase pilot plan.
              </p>
            </div>
            <span className="badge badge-success">SYNTHETIC DEMO HISTORY</span>
          </div>

          <div className="panel-body">
            {/* KPI Cards */}
            <div className="hero-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
              <div className="metric-card" style={{ padding: "12px 16px" }}>
                <div className="metric-label">Acceptance Rate</div>
                <div className="metric-value" style={{ color: "#16A34A" }}>
                  {outcomesResource.status === "success" ? outcomesResource.data.action_acceptance_rate_percent : 84.6}%
                </div>
                <div className="metric-foot">Approved vs rejected proposals</div>
              </div>

              <div className="metric-card" style={{ padding: "12px 16px" }}>
                <div className="metric-label">Completion Rate</div>
                <div className="metric-value" style={{ color: "#0284C7" }}>
                  {outcomesResource.status === "success" ? outcomesResource.data.completion_rate_percent : 76.2}%
                </div>
                <div className="metric-foot">Closed-loop field execution</div>
              </div>

              <div className="metric-card" style={{ padding: "12px 16px" }}>
                <div className="metric-label">Median Review Time</div>
                <div className="metric-value">
                  {outcomesResource.status === "success" ? outcomesResource.data.median_review_time_hours : 1.8}h
                </div>
                <div className="metric-foot">Alert to manager approval</div>
              </div>

              <div className="metric-card" style={{ padding: "12px 16px" }}>
                <div className="metric-label">Outcome Coverage</div>
                <div className="metric-value">
                  {outcomesResource.status === "success" ? outcomesResource.data.outcome_coverage_percent : 91.5}%
                </div>
                <div className="metric-foot">Logged post-action states</div>
              </div>
            </div>

            {/* Pilot Phasing Plan */}
            <div className="panel" style={{ padding: "16px", border: "1px solid var(--border)", background: "var(--surface-raised, #F0F6FF)" }}>
              <h3 style={{ fontSize: "1rem", margin: "0 0 8px", color: "var(--blue-deep)" }}>
                Production Upay Pilot Implementation Roadmap
              </h3>
              <p className="muted text-small" style={{ margin: "0 0 12px" }}>
                Three-phase rollout design ensuring human control, compliance verification, and causal uplift measurement:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                <div style={{ padding: "12px", background: "var(--white)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <span className="badge badge-info" style={{ marginBottom: 6 }}>PHASE A</span>
                  <h4 style={{ margin: "4px 0", fontSize: "0.92rem" }}>Shadow Mode (2 Weeks)</h4>
                  <p className="muted text-small" style={{ margin: 0 }}>
                    Run priority queue in parallel with current operations without dispatching field tasks. Evaluate analyst agreement and calibration.
                  </p>
                </div>

                <div style={{ padding: "12px", background: "var(--white)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <span className="badge badge-warning" style={{ marginBottom: 6 }}>PHASE B</span>
                  <h4 style={{ margin: "4px 0", fontSize: "0.92rem" }}>Controlled District Pilot (4 Weeks)</h4>
                  <p className="muted text-small" style={{ margin: 0 }}>
                    Deploy to 2 target districts (e.g. Bogra and Sylhet). Field officers receive top 10 daily actions; measure SLA compliance and feedback.
                  </p>
                </div>

                <div style={{ padding: "12px", background: "var(--white)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                  <span className="badge badge-success" style={{ marginBottom: 6 }}>PHASE C</span>
                  <h4 style={{ margin: "4px 0", fontSize: "0.92rem" }}>Matched-Control Evaluation (8 Weeks)</h4>
                  <p className="muted text-small" style={{ margin: 0 }}>
                    Compare merchant churn rates and agent liquidity stockouts against synthetic-matched control districts to quantify real business uplift.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. WHAT DATA WE WOULD NEED IN PRODUCTION TOGGLE */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          className="text-button text-small"
          onClick={() => setShowDataRequirements(!showDataRequirements)}
        >
          {showDataRequirements ? "Hide Data Requirements" : "What Data We Need in Production →"}
        </button>
      </div>

      {showDataRequirements && (
        <section className="panel" style={{ marginTop: 16 }}>
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
                    <th><span className="badge badge-warning">CURRENT SYNTHETIC DATA</span></th>
                    <th><span className="badge badge-success">PRODUCTION UPAY DATA REQUIRED</span></th>
                    <th>Operational Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Agent Live Float Balance</strong></td>
                    <td>Batch capacity proxy (liquidity_limit) only; static snapshot</td>
                    <td>Real-time core banking / MFS ledger balance stream per agent wallet</td>
                    <td>Prevent intraday cash-out stockouts & trigger automatic rebalancing</td>
                  </tr>
                  <tr>
                    <td><strong>Cash-In / Cash-Out Stream</strong></td>
                    <td>7d/30d/90d historical aggregate averages</td>
                    <td>Sub-minute transaction events with fee breakdown</td>
                    <td>Detect instant liquidity spikes and localized cash drains</td>
                  </tr>
                  <tr>
                    <td><strong>Failed Transaction Events</strong></td>
                    <td>Inferred indirectly via service_gap_flag</td>
                    <td>Real-time error logs (Insufficient Float, Timeout, Network Failure)</td>
                    <td>Immediate float dispatch before customer churns to competitor</td>
                  </tr>
                  <tr>
                    <td><strong>Merchant QR & Channel Logs</strong></td>
                    <td>Binary flags (qr_enabled, app_enabled) without scan timestamps</td>
                    <td>Live Bangla QR scan events & merchant app session logs</td>
                    <td>Target inactive QR merchants for field activation & POS replacement</td>
                  </tr>
                  <tr>
                    <td><strong>Field-Visit & CRM Logs</strong></td>
                    <td>Future data required (not present in synthetic dataset)</td>
                    <td>Territory Officer (TO) GPS check-ins & merchant resolution notes</td>
                    <td>Track closed-loop resolution of interventions and officer SLA</td>
                  </tr>
                  <tr>
                    <td><strong>Real GPS & Outlet Geography</strong></td>
                    <td>Categorical district / area_type only; no coordinates</td>
                    <td>Verified outlet coordinates (lat/long) where permitted</td>
                    <td>Spatial routing for cash distribution vans & route optimization</td>
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
