"use client";

import { useMemo, useState } from "react";
import { Compass, Layers3, MapPinned, Store, UsersRound, Sparkles, Activity } from "lucide-react";

import {
  EmptyState, ErrorState, FilterSelect, LoadingState, PageHeader,
  Pagination, RiskBadge, SourceBadge, SyntheticBadge,
  CountDisplay, InterventionComposer
} from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { PageResult } from "@/lib/types";
import { useLanguage } from "@/providers/LanguageProvider";

interface LocationRow extends Record<string, unknown> {
  location_id?: string;
  district?: string;
  area_type?: string;
  location_opportunity_score?: number;
  merchant_expansion_score?: number;
  agent_expansion_score?: number;
  demand_opportunity_score?: number;
  expansion_priority?: string;
  recommended_expansion?: string;
  recommendation_reason?: string;
  recommended_action?: string;
}

const DISTRICT_HUBS: Record<string, { x: number; y: number; label: string }> = {
  "Rangpur": { x: 190, y: 110, label: "Rangpur" },
  "Rajshahi": { x: 230, y: 250, label: "Rajshahi" },
  "Mymensingh": { x: 470, y: 110, label: "Mymensingh" },
  "Sylhet": { x: 740, y: 130, label: "Sylhet" },
  "Dhaka": { x: 480, y: 260, label: "Dhaka" },
  "Khulna": { x: 270, y: 400, label: "Khulna" },
  "Barishal": { x: 490, y: 420, label: "Barishal" },
  "Chattogram": { x: 730, y: 380, label: "Chattogram" },
};

const views = [
  { key: "location_opportunity_score", labelKey: "loc.overall_score", fallback: "Overall Opportunity" },
  { key: "merchant_expansion_score", labelKey: "loc.merchant_score", fallback: "Merchant Expansion" },
  { key: "agent_expansion_score", labelKey: "loc.agent_score", fallback: "Agent Expansion" },
  { key: "demand_opportunity_score", labelKey: "loc.demand_score", fallback: "Demand Pressure" },
] as const;

export default function LocationsPage() {
  const { t } = useLanguage();
  const [district, setDistrict] = useState("");
  const [areaType, setAreaType] = useState("");
  const [priority, setPriority] = useState("");
  const [expansion, setExpansion] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<(typeof views)[number]["key"]>("location_opportunity_score");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ id: string; x: number; y: number; row: LocationRow } | null>(null);
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams({ limit: "100", offset: String(offset) });
  if (district) params.set("district", district);
  if (areaType) params.set("area_type", areaType);
  if (priority) params.set("expansion_priority", priority);
  if (expansion) params.set("recommended_expansion", expansion);

  const resource = useApi<PageResult<LocationRow>>(`/api/v1/locations/opportunities?${params.toString()}`);
  const allRows = resource.status === "success" ? resource.data.items : [];

  // Filter rows by search query (location_id, district, area_type)
  const rows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase();
    return allRows.filter((r) =>
      String(r.location_id ?? "").toLowerCase().includes(q) ||
      String(r.district ?? "").toLowerCase().includes(q) ||
      String(r.area_type ?? "").toLowerCase().includes(q)
    );
  }, [allRows, searchQuery]);

  // Selected item
  const selected = useMemo(() => {
    return rows.find((r) => r.location_id === selectedId) ?? rows[0];
  }, [rows, selectedId]);

  // Derived summary counts
  const totalAnalyzed = resource.status === "success" ? resource.data.total : 0;
  const highOrCriticalCount = useMemo(() => {
    return allRows.filter((r) => ["HIGH", "CRITICAL"].includes(String(r.expansion_priority ?? "").toUpperCase())).length;
  }, [allRows]);
  const merchantSignalsCount = useMemo(() => {
    return allRows.filter((r) => String(r.recommended_expansion ?? "").includes("MERCHANT")).length;
  }, [allRows]);
  const agentSignalsCount = useMemo(() => {
    return allRows.filter((r) => String(r.recommended_expansion ?? "").includes("AGENT")).length;
  }, [allRows]);

  // Group nodes by district clusters
  const clusters = useMemo(() => {
    const map = new Map<string, { hub: { x: number; y: number; label: string }; items: LocationRow[] }>();

    // Initialize all district hubs
    for (const [name, hub] of Object.entries(DISTRICT_HUBS)) {
      map.set(name, { hub, items: [] });
    }

    // Populate with matching rows
    for (const row of rows) {
      const dName = String(row.district ?? "Dhaka");
      const entry = map.get(dName) ?? { hub: { x: 480, y: 260, label: dName }, items: [] };
      entry.items.push(row);
      map.set(dName, entry);
    }

    // Compute coordinates for each node in orbital layout around its hub
    return Array.from(map.entries()).map(([dName, { hub, items }]) => {
      const count = items.length;
      const baseRadius = Math.max(34, Math.min(68, 22 + count * 2.8));

      const nodes = items.map((row, idx) => {
        const angle = (idx / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
        const radialVariance = (idx % 2 === 0 ? 1 : 0.82);
        const radius = baseRadius * radialVariance;
        const x = hub.x + radius * Math.cos(angle);
        const y = hub.y + radius * Math.sin(angle);
        const scoreVal = typeof row[view] === "number" ? Math.max(0, Math.min(Number(row[view]), 100)) : 0;
        const dotRadius = 4 + (scoreVal / 100) * 4.5;
        const isSelected = (selected?.location_id === row.location_id);
        const isHighOrCritical = ["HIGH", "CRITICAL"].includes(String(row.expansion_priority ?? "").toUpperCase());

        return {
          row,
          x,
          y,
          dotRadius,
          scoreVal,
          isSelected,
          isHighOrCritical,
        };
      });

      return {
        district: dName,
        hub,
        baseRadius,
        count,
        nodes,
      };
    });
  }, [rows, view, selected]);

  return (
    <>
      <PageHeader
        eyebrow={t("nav.locations", "LOCATION INTELLIGENCE")}
        title={t("loc.title", "Expansion Opportunities")}
        description={t("loc.subtitle", "Identify where additional merchant or agent coverage may create value.")}
        actions={<><SyntheticBadge /><SourceBadge>{t("loc.trust_label", "Schematic view • Review before action")}</SourceBadge></>}
      />

      {/* Mandatory Non-GPS Disclaimer */}
      <div className="notice notice-warning" style={{ marginBottom: 16 }}>
        <Compass size={15} />
        <span>{t("loc.schematic_warning", "Schematic view — not real GPS locations. Priority is a relative opportunity index, not an emergency rating.")}</span>
      </div>

      {/* Derived Summary Cards */}
      <section className="hero-kpi-row" aria-label="Location intelligence totals">
        <div className="metric-card">
          <div className="metric-label"><MapPinned size={14} /> {t("loc.locations_analyzed", "Locations Analyzed")}</div>
          <div className="metric-value">{resource.status === "success" ? <CountDisplay value={totalAnalyzed} /> : "—"}</div>
          <div className="metric-foot"><SourceBadge>{t("cc.schematic_note", "Synthetic schematic · not GPS")}</SourceBadge></div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><Activity size={14} /> {t("loc.high_critical", "High / Critical Opportunities")}</div>
          <div className="metric-value">{resource.status === "success" ? <CountDisplay value={highOrCriticalCount} /> : "—"}</div>
          <div className="metric-foot">{t("common.priority", "Priority")} &ge; HIGH</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><Store size={14} /> {t("loc.merchant_expansion_signals", "Merchant Expansion Signals")}</div>
          <div className="metric-value">{resource.status === "success" ? <CountDisplay value={merchantSignalsCount} /> : "—"}</div>
          <div className="metric-foot">{t("loc.merchant_score", "Merchant Expansion")}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><UsersRound size={14} /> {t("loc.agent_expansion_signals", "Agent Expansion Signals")}</div>
          <div className="metric-value">{resource.status === "success" ? <CountDisplay value={agentSignalsCount} /> : "—"}</div>
          <div className="metric-foot">{t("loc.agent_score", "Agent Expansion")}</div>
        </div>
      </section>

      {/* Toolbar Filters */}
      <div className="toolbar-row">
        <label className="search-field" style={{ minWidth: 200 }}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t("common.search", "Search")} ID, ${t("loc.district", "District")}...`}
            aria-label="Search locations"
          />
        </label>
        <FilterSelect
          label={t("loc.district", "District")}
          value={district}
          onChange={(v) => { setDistrict(v); setOffset(0); }}
          options={["Dhaka", "Barishal", "Rangpur", "Khulna", "Sylhet", "Rajshahi", "Chattogram", "Mymensingh"]}
        />
        <FilterSelect
          label={t("loc.area_type", "Area Type")}
          value={areaType}
          onChange={(v) => { setAreaType(v); setOffset(0); }}
          options={["Urban", "Suburban", "Rural"]}
        />
        <FilterSelect
          label={t("loc.priority", "Priority")}
          value={priority}
          onChange={(v) => { setPriority(v); setOffset(0); }}
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
        />
        <FilterSelect
          label={t("loc.recommendation", "Recommended Expansion")}
          value={expansion}
          onChange={(v) => { setExpansion(v); setOffset(0); }}
          options={["MONITOR_CURRENT_COVERAGE", "MERCHANT_AND_AGENT_EXPANSION", "AGENT_EXPANSION", "MERCHANT_EXPANSION"]}
        />
      </div>

      {/* Layer Tabs */}
      <div className="status-tabs" role="tablist" aria-label="Opportunity score layer">
        {views.map((item) => (
          <button
            key={item.key}
            role="tab"
            aria-selected={view === item.key}
            className={`status-tab ${view === item.key ? "active" : ""}`}
            onClick={() => setView(item.key)}
          >
            <Layers3 size={12} /> {t(item.labelKey, item.fallback)}
          </button>
        ))}
      </div>

      {resource.status === "loading" && <LoadingState label="Loading validated location indices" />}
      {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
      {resource.status === "success" && rows.length === 0 && (
        <EmptyState title="No location indices match" detail="The selected filters returned no rows from the location intelligence API." />
      )}

      {/* Hybrid Layout: Opportunity Network on Left, Selected Panel on Right */}
      {resource.status === "success" && rows.length > 0 && (
        <div className="opportunity-layout">
          {/* Opportunity Network Canvas (NO overlapping text!) */}
          <section className="opportunity-canvas" aria-label="Schematic constellation of synthetic locations">
            <p className="network-caption">
              <Sparkles size={11} style={{ color: "var(--yellow-warm)" }} />
              {t("loc.caption", "SCHEMATIC VIEW — NOT REAL GPS LOCATIONS · RELATIVE OPPORTUNITY NETWORK")}
            </p>

            <svg
              className="opportunity-network"
              viewBox="0 0 960 520"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Interactive district clusters sized by relative opportunity score"
            >
              {/* Inter-cluster schematic backbone lines */}
              <g className="cluster-backbone" stroke="rgba(25,118,233,0.14)" strokeWidth="1" strokeDasharray="3 3">
                <line x1={480} y1={260} x2={730} y2={380} />
                <line x1={480} y1={260} x2={740} y2={130} />
                <line x1={480} y1={260} x2={500} y2={110} />
                <line x1={480} y1={260} x2={230} y2={250} />
                <line x1={480} y1={260} x2={270} y2={400} />
                <line x1={480} y1={260} x2={490} y2={420} />
                <line x1={230} y1={250} x2={190} y2={110} />
                <line x1={500} y1={110} x2={190} y2={110} />
                <line x1={270} y1={400} x2={490} y2={420} />
                <line x1={490} y1={420} x2={730} y2={380} />
              </g>

              {/* District Cluster Zones & Nodes */}
              {clusters.map((cluster) => {
                if (cluster.count === 0) return null;
                const hasSelected = cluster.nodes.some((n) => n.isSelected);

                return (
                  <g key={cluster.district} className="district-group">
                    {/* Subtle cluster background halo */}
                    <circle
                      cx={cluster.hub.x}
                      cy={cluster.hub.y}
                      r={cluster.baseRadius + 14}
                      fill={hasSelected ? "rgba(255,212,59,0.06)" : "rgba(234,244,255,0.45)"}
                      stroke={hasSelected ? "rgba(255,184,0,0.35)" : "rgba(25,118,233,0.18)"}
                      strokeWidth={hasSelected ? 1.5 : 1}
                      strokeDasharray={hasSelected ? undefined : "3 3"}
                    />

                    {/* District cluster header text (rendered once per cluster, clean!) */}
                    <text
                      x={cluster.hub.x}
                      y={cluster.hub.y - cluster.baseRadius - 4}
                      className="district-cluster-heading"
                      textAnchor="middle"
                    >
                      {cluster.district} · {cluster.count}
                    </text>

                    {/* Radial connecting lines to hub */}
                    {cluster.nodes.map((node) => (
                      <line
                        key={`spoke-${node.row.location_id}`}
                        x1={cluster.hub.x}
                        y1={cluster.hub.y}
                        x2={node.x}
                        y2={node.y}
                        stroke={node.isSelected ? "rgba(255,184,0,0.4)" : "rgba(25,118,233,0.1)"}
                        strokeWidth={node.isSelected ? 1.2 : 0.8}
                      />
                    ))}

                    {/* Location Nodes — NO hardcoded overlapping text! */}
                    {cluster.nodes.map((node) => {
                      const locId = String(node.row.location_id ?? "");

                      return (
                        <g
                          key={locId}
                          className={`opportunity-node-group ${node.isSelected ? "is-selected" : ""}`}
                          onClick={() => setSelectedId(locId)}
                          onMouseEnter={() => setHoveredNode({ id: locId, x: node.x, y: node.y, row: node.row })}
                          onMouseLeave={() => setHoveredNode((prev) => (prev?.id === locId ? null : prev))}
                          tabIndex={0}
                          role="button"
                          aria-label={`${locId}, ${cluster.district}, score ${node.scoreVal}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setSelectedId(locId);
                          }}
                        >
                          {/* Pulsing ring around selected node */}
                          {node.isSelected && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.dotRadius + 5}
                              fill="none"
                              stroke="var(--yellow-warm)"
                              strokeWidth="2.5"
                              className="node-pulse-ring"
                            />
                          )}

                          {/* Node Circle */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.dotRadius}
                            fill={
                              node.isSelected
                                ? "var(--blue-primary)"
                                : node.isHighOrCritical
                                ? "var(--yellow-warm)"
                                : "var(--blue-interactive)"
                            }
                            stroke={node.isSelected ? "var(--yellow-primary)" : "white"}
                            strokeWidth={node.isSelected ? 2 : 1.2}
                            style={{
                              filter: node.isSelected ? "drop-shadow(0 0 6px rgba(255,184,0,0.7))" : undefined,
                              cursor: "pointer",
                              transition: "transform 0.2s, fill 0.2s",
                            }}
                          />

                          {/* Selected Callout Tag (ONLY for the selected location, elegant and readable!) */}
                          {node.isSelected && (
                            <g className="selected-node-tag" pointerEvents="none">
                              <rect
                                x={node.x - 34}
                                y={node.y - node.dotRadius - 22}
                                width={68}
                                height={18}
                                rx={9}
                                fill="var(--blue-deep)"
                                stroke="var(--yellow-warm)"
                                strokeWidth="1"
                              />
                              <text
                                x={node.x}
                                y={node.y - node.dotRadius - 10}
                                fill="white"
                                fontSize="9"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {locId}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Floating Tooltip inside SVG */}
              {hoveredNode && hoveredNode.id !== selected?.location_id && (
                <g
                  className="interactive-node-tooltip"
                  transform={`translate(${hoveredNode.x}, ${hoveredNode.y - 48})`}
                  pointerEvents="none"
                >
                  <rect
                    x="-65"
                    y="0"
                    width="130"
                    height="40"
                    rx="8"
                    fill="var(--white)"
                    stroke="var(--blue-interactive)"
                    strokeWidth="1.2"
                    filter="drop-shadow(0 4px 12px rgba(16,42,67,0.18))"
                  />
                  <text x="0" y="15" fill="var(--blue-deep)" fontSize="10" fontWeight="700" textAnchor="middle">
                    {hoveredNode.id} · {String(hoveredNode.row.district)}
                  </text>
                  <text x="0" y="30" fill="var(--body)" fontSize="8.5" textAnchor="middle">
                    {String(hoveredNode.row.area_type)} · {t("loc.relative_score", "Score")}: {formatNumber(hoveredNode.row[view])}
                  </text>
                </g>
              )}
            </svg>

            {/* Opportunity Legend */}
            <div className="opportunity-legend">
              <span className="legend-item"><i className="legend-dot" style={{ background: "var(--blue-interactive)" }} /> {t("common.priority", "Standard Opportunity")}</span>
              <span className="legend-item"><i className="legend-dot" style={{ background: "var(--yellow-warm)" }} /> {t("loc.high_critical", "High / Critical Opportunity")}</span>
              <span className="legend-item"><i className="legend-dot" style={{ background: "var(--blue-primary)", outline: "2px solid var(--yellow-warm)" }} /> {t("loc.selected_location", "Selected Location")}</span>
              <SourceBadge>{t("cc.schematic_note", "Schematic · not GPS")}</SourceBadge>
            </div>
          </section>

          {/* Right Column: Selected Location Intelligence Panel */}
          <aside className="panel location-detail-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t("loc.selected_location", "Selected Location Intelligence")}</p>
                <h2>{selected ? String(selected.location_id) : t("loc.selected_location", "Location")}</h2>
              </div>
              {selected && <RiskBadge value={String(selected.expansion_priority ?? "Not supplied")} />}
            </div>

            {selected ? (
              <div className="panel-body">
                <div className="selected-loc-header">
                  <h3>
                    {String(selected.district)} <span className="muted">/ {String(selected.area_type)}</span>
                  </h3>
                  <p className="muted text-small">{t("loc.relative_score", "Relative Opportunity Score")} · 0–100</p>
                </div>

                {/* Progress / Horizontal Bars with yellow opportunity highlight */}
                <div className="score-bars-container">
                  <div className="score-bar-group">
                    <div className="score-bar-head">
                      <span>{t("loc.relative_score", "Relative Opportunity Score")}</span>
                      <strong>{formatNumber(selected.location_opportunity_score)} <small>/ 100</small></strong>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill score-bar-fill-yellow"
                        style={{ width: `${Math.min(100, Math.max(0, Number(selected.location_opportunity_score ?? 0)))}%` }}
                      />
                    </div>
                  </div>

                  <div className="score-bar-group">
                    <div className="score-bar-head">
                      <span>{t("loc.merchant_score", "Merchant Expansion")}</span>
                      <strong>{formatNumber(selected.merchant_expansion_score)}</strong>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill score-bar-fill-blue"
                        style={{ width: `${Math.min(100, Math.max(0, Number(selected.merchant_expansion_score ?? 0)))}%` }}
                      />
                    </div>
                  </div>

                  <div className="score-bar-group">
                    <div className="score-bar-head">
                      <span>{t("loc.agent_score", "Agent Expansion")}</span>
                      <strong>{formatNumber(selected.agent_expansion_score)}</strong>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill score-bar-fill-blue"
                        style={{ width: `${Math.min(100, Math.max(0, Number(selected.agent_expansion_score ?? 0)))}%` }}
                      />
                    </div>
                  </div>

                  <div className="score-bar-group">
                    <div className="score-bar-head">
                      <span>{t("loc.demand_score", "Demand Pressure")}</span>
                      <strong>{formatNumber(selected.demand_opportunity_score)}</strong>
                    </div>
                    <div className="score-bar-track">
                      <div
                        className="score-bar-fill score-bar-fill-blue"
                        style={{ width: `${Math.min(100, Math.max(0, Number(selected.demand_opportunity_score ?? 0)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="muted text-small" style={{ margin: "14px 0 10px" }}>
                  <em>Relative Opportunity Score reflects synthetic cluster ranking. It is not an accuracy or probability rating.</em>
                </p>

                {/* Recommendation Callout */}
                <div className="notice notice-gold" style={{ marginTop: 14 }}>
                  <strong>{String(selected.recommended_expansion ?? "").replaceAll("_", " ")}</strong>
                  <p style={{ marginTop: 4 }}>{String(selected.recommendation_reason ?? "No recommendation reason supplied.")}</p>
                </div>

                <p className="text-small muted" style={{ marginTop: 12 }}>
                  <strong>{t("common.recommendation", "Action")}:</strong> {String(selected.recommended_action ?? "Review location coverage with operations team.")}
                </p>

                {/* Propose Review Action */}
                <div style={{ marginTop: 18 }}>
                  <InterventionComposer
                    targetType="location"
                    targetId={String(selected.location_id ?? "")}
                    capability="location_expansion"
                    recommendation={String(selected.recommended_action ?? "Review location coverage")}
                    reason={String(selected.recommendation_reason ?? "Opportunity score review")}
                  />
                </div>
              </div>
            ) : (
              <div className="panel-body">
                <EmptyState title="Choose a node" detail={t("loc.choose_node", "Select an opportunity node to inspect its relative indices.")} />
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Bottom Ranked Location Table */}
      {resource.status === "success" && rows.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t("loc.ranked_list", "Ranked Locations")}</p>
              <h2>{t("loc.ranked_list", "Ranked Locations")} ({rows.length})</h2>
            </div>
            <SourceBadge>{t("shell.latest_data", "Latest Analyzed Data")}</SourceBadge>
          </div>

          {/* Desktop Table View */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("nav.locations", "Location")}</th>
                  <th>{t("loc.district", "District")}</th>
                  <th>{t("loc.area_type", "Area Type")}</th>
                  <th>{t("loc.relative_score", "Relative Opportunity Score")}</th>
                  <th>{t("common.priority", "Priority")}</th>
                  <th>{t("loc.recommendation", "Recommended Expansion")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelected = selected?.location_id === row.location_id;
                  return (
                    <tr
                      key={String(row.location_id)}
                      className={isSelected ? "row-selected" : ""}
                      onClick={() => setSelectedId(String(row.location_id))}
                      style={{ cursor: "pointer" }}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setSelectedId(String(row.location_id));
                      }}
                    >
                      <td><strong className="table-primary">{String(row.location_id)}</strong></td>
                      <td>{String(row.district ?? "—")}</td>
                      <td>{String(row.area_type ?? "—")}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--blue-primary)" }}>
                          {formatNumber(row[view])}
                        </span>
                      </td>
                      <td><RiskBadge value={String(row.expansion_priority ?? "Not supplied")} /></td>
                      <td>{String(row.recommended_expansion ?? "—").replaceAll("_", " ")}</td>
                      <td>
                        <button
                          type="button"
                          className="button button-small"
                          style={{
                            background: isSelected ? "var(--yellow-warm)" : "var(--blue-light)",
                            color: isSelected ? "var(--blue-deep)" : "var(--blue-primary)",
                            border: "none",
                            fontWeight: 600,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(String(row.location_id));
                          }}
                        >
                          {isSelected ? "Selected" : "Inspect"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Ranked Cards (360px) */}
          <div className="mobile-row-list">
            {rows.map((row) => {
              const isSelected = selected?.location_id === row.location_id;
              return (
                <button
                  type="button"
                  className={`mobile-data-row ${isSelected ? "row-selected" : ""}`}
                  key={String(row.location_id)}
                  onClick={() => setSelectedId(String(row.location_id))}
                  style={{ textAlign: "left", width: "100%", background: isSelected ? "var(--blue-light)" : undefined }}
                >
                  <div>
                    <strong>{String(row.location_id)} · {String(row.district)}</strong>
                    <p className="muted">{String(row.area_type)} · {t("loc.relative_score", "Score")}: {formatNumber(row[view])}</p>
                  </div>
                  <RiskBadge value={String(row.expansion_priority ?? "Not supplied")} />
                </button>
              );
            })}
          </div>

          <Pagination total={resource.data.total} limit={resource.data.limit} offset={offset} onChange={setOffset} />
        </section>
      )}
    </>
  );
}
