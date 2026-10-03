"use client";

import { useMemo, useState } from "react";
import { Compass, Layers3 } from "lucide-react";

import { EmptyState, ErrorState, FilterSelect, LoadingState, PageHeader, Pagination, RiskBadge, SourceBadge, SyntheticBadge } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { PageResult } from "@/lib/types";

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
}

const views = [
  { key: "location_opportunity_score", label: "Overall Opportunity" },
  { key: "merchant_expansion_score", label: "Merchant Expansion" },
  { key: "agent_expansion_score", label: "Agent Expansion" },
  { key: "demand_opportunity_score", label: "Demand Pressure" },
] as const;

export default function LocationsPage() {
  const [district, setDistrict] = useState("");
  const [areaType, setAreaType] = useState("");
  const [priority, setPriority] = useState("");
  const [expansion, setExpansion] = useState("");
  const [view, setView] = useState<(typeof views)[number]["key"]>("location_opportunity_score");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: "100", offset: String(offset) });
  if (district) params.set("district", district);
  if (areaType) params.set("area_type", areaType);
  if (priority) params.set("expansion_priority", priority);
  if (expansion) params.set("recommended_expansion", expansion);
  const resource = useApi<PageResult<LocationRow>>(`/api/v1/locations/opportunities?${params.toString()}`);
  const rows = resource.status === "success" ? resource.data.items : [];
  const selected = rows.find((row) => row.location_id === selectedId) ?? rows[0];
  const layout = useMemo(() => rows.map((row, index) => ({ row, x: 8 + (index % 10) * 9.3, y: 19 + Math.floor(index / 10) * 20 })), [rows]);

  return <>
    <PageHeader eyebrow="NETWORK INTELLIGENCE / 04" title="Opportunity constellation" description="A synthetic schematic view of relative location indices. Node arrangement is illustrative and does not represent geographic coordinates." actions={<SyntheticBadge />} />
    <div className="notice notice-warning" style={{ marginBottom: 15 }}><Compass size={15} /><span>Synthetic schematic visualization — not real GPS coordinates. Priority is a relative opportunity index, not an emergency rating.</span></div>
    <div className="toolbar-row"><FilterSelect label="District" value={district} onChange={setDistrict} options={["Dhaka", "Barishal", "Rangpur", "Khulna", "Sylhet", "Rajshahi", "Chattogram", "Mymensingh"]} /><FilterSelect label="Area type" value={areaType} onChange={setAreaType} options={["Urban", "Suburban", "Rural"]} /><FilterSelect label="Priority" value={priority} onChange={setPriority} options={["LOW", "MEDIUM", "HIGH", "CRITICAL"]} /><FilterSelect label="Recommended expansion" value={expansion} onChange={setExpansion} options={["MONITOR_CURRENT_COVERAGE", "MERCHANT_AND_AGENT_EXPANSION", "AGENT_EXPANSION", "MERCHANT_EXPANSION"]} /></div>
    <div className="status-tabs" role="tablist" aria-label="Opportunity score layer">{views.map((item) => <button key={item.key} role="tab" aria-selected={view === item.key} className={`status-tab ${view === item.key ? "active" : ""}`} onClick={() => setView(item.key)}><Layers3 size={12} /> {item.label}</button>)}</div>
    {resource.status === "loading" && <LoadingState label="Loading validated location indices" />}
    {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
    {resource.status === "success" && rows.length === 0 && <EmptyState title="No location indices match" detail="The selected filters returned no rows from the location intelligence API." />}
    {resource.status === "success" && rows.length > 0 && <div className="mobile-opportunity-list">{rows.map((row) => <button className="mobile-data-row" key={String(row.location_id)} onClick={() => setSelectedId(String(row.location_id))}><div><strong>{String(row.location_id)} · {String(row.district)}</strong><p className="muted">{String(row.area_type)} · score {formatNumber(row[view])}</p></div><RiskBadge value={String(row.expansion_priority ?? "Not supplied")} /></button>)}</div>}
    {resource.status === "success" && rows.length > 0 && <div className="opportunity-layout">
      <section className="opportunity-canvas" aria-label="Schematic constellation of synthetic locations">
        <p className="network-caption">SCHEMATIC NODE PLACEMENT · DECORATIVE LINKS · NOT GEOGRAPHIC</p>
        <svg className="opportunity-network" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Interactive nodes sized by supplied opportunity score, arranged schematically">
          {layout.map(({ row, x, y }, index) => {
            const scoreValue = row[view];
            const score = typeof scoreValue === "number" ? Math.max(0, Math.min(scoreValue, 100)) : 0;
            const radius = 1.3 + score / 28;
            const next = layout[index + 1];
            return <g key={String(row.location_id)} className="opportunity-node" role="button" tabIndex={0} aria-label={`${String(row.location_id)}, ${String(row.district)}, score ${scoreValue === undefined ? "not supplied" : scoreValue}`} onClick={() => setSelectedId(String(row.location_id))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(String(row.location_id)); }}>
              {next && <line x1={x} y1={y} x2={next.x} y2={next.y} stroke="rgba(214,182,108,.16)" strokeWidth=".22" />}
              <line x1={x} y1={y} x2={x} y2={y + 4 + score / 22} stroke="rgba(214,182,108,.33)" strokeWidth=".35" />
              <circle cx={x} cy={y} r={radius} fill={selected?.location_id === row.location_id ? "#f0d48a" : "#c9a85e"} fillOpacity={selected?.location_id === row.location_id ? ".92" : ".65"} stroke="#f0d48a" strokeOpacity=".55" strokeWidth=".35" />
              <text x={x} y={y - radius - 1}>{String(row.location_id)}</text>
            </g>;
          })}
        </svg>
        <div className="opportunity-legend"><span className="legend-item"><i className="legend-dot" /> Node height/strength uses the selected supplied score</span><SourceBadge /></div>
      </section>
      <aside className="panel"><div className="panel-heading"><h2>Selected location</h2><RiskBadge value={String(selected?.expansion_priority ?? "Not supplied")} /></div>{selected ? <div className="panel-body"><p className="eyebrow">{String(selected.location_id)}</p><h2>{String(selected.district)} <span className="muted">/ {String(selected.area_type)}</span></h2><div className="data-pair-grid" style={{ marginTop: 20 }}><div className="data-pair"><small>Opportunity score</small><strong>{formatNumber(selected.location_opportunity_score)}</strong></div><div className="data-pair"><small>Merchant expansion</small><strong>{formatNumber(selected.merchant_expansion_score)}</strong></div><div className="data-pair"><small>Agent expansion</small><strong>{formatNumber(selected.agent_expansion_score)}</strong></div><div className="data-pair"><small>Demand opportunity</small><strong>{formatNumber(selected.demand_opportunity_score)}</strong></div></div><div className="notice notice-gold" style={{ marginTop: 18 }}>{String(selected.recommendation_reason ?? "No recommendation reason supplied.")}</div><p className="text-small muted" style={{ marginTop: 13 }}>{String(selected.recommended_action ?? "No action supplied.")}</p></div> : <div className="panel-body"><EmptyState title="Choose a node" detail="Select an opportunity node to inspect its supplied indices." /></div>}</aside>
    </div>}
    {resource.status === "success" && <Pagination total={resource.data.total} limit={resource.data.limit} offset={offset} onChange={setOffset} />}
  </>;
}
