"use client";

import { Activity, Eye, MapPinOff, ShieldCheck, Sparkles } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, PageHeader, ReasonList, SourceBadge, SyntheticBadge } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { PageResult, RegistryModel } from "@/lib/types";

const responsibleItems = [
  { icon: Sparkles, title: "Synthetic data", detail: "Every supplied entity and intelligence value is synthetic." },
  { icon: Eye, title: "Documented limits", detail: "Model and engine boundaries are shown alongside each capability." },
  { icon: ShieldCheck, title: "Human oversight", detail: "Consequential proposals require an authorized human decision." },
  { icon: Activity, title: "No autonomous action", detail: "The application records workflow state; it does not execute it." },
  { icon: MapPinOff, title: "No real GPS", detail: "Location nodes are schematic indices without coordinates." },
  { icon: ShieldCheck, title: "Operational review", detail: "Abnormal activity is not a fraud conclusion." },
];

function metricEntries(metrics: RegistryModel["documented_metrics"]) {
  return Object.entries(metrics).flatMap(([key, value]) => {
    if (value && typeof value === "object") return Object.entries(value).map(([nestedKey, nestedValue]) => [`${key} ${nestedKey}`, String(nestedValue)] as const);
    return [[key, String(value)] as const];
  });
}

function ModelCard({ model }: { model: RegistryModel }) {
  const isML = model.engine_type.startsWith("ML:");
  const badgeLabel = isML
    ? "MACHINE LEARNING"
    : model.engine_type.includes("PERCENTILE")
      ? "PERCENTILE ENGINE"
      : "RULE ENGINE";

  return (
    <article className="model-card">
      <div className="model-card-head">
        <div>
          <p className="eyebrow">{badgeLabel}</p>
          <h2>{model.capability}</h2>
          <p className="model-engine">{model.engine_type}</p>
        </div>
        <span className={`badge ${isML ? "badge-success" : "badge-neutral"}`}>{badgeLabel}</span>
      </div>

      <div className="model-facts">
        <span><small>Serving</small>{model.serving_mode}</span>
        <span><small>Horizon</small>{model.horizon ?? "Snapshot"}</span>
        {model.version && <span><small>Model Version</small>{model.version}</span>}
        {model.data_version && <span><small>Data Version</small>{model.data_version}</span>}
        {model.baseline && <span><small>Baseline</small>{model.baseline}</span>}
        {model.forecast_scope && <span><small>Scope</small>{model.forecast_scope}</span>}
      </div>

      {model.artifact && (
        <p className="muted text-small" style={{ marginTop: 8 }}>
          Batch artifact: <code>{model.artifact}</code>
        </p>
      )}

      {/* Top Features */}
      {model.top_features && model.top_features.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="section-label">Top Predictive Features</p>
          <div className="table-wrap" style={{ marginTop: 6, marginBottom: 10 }}>
            <table style={{ fontSize: "0.82rem" }}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Importance Score</th>
                  {model.top_features[0].normalized_pct !== undefined && <th>Weight (%)</th>}
                </tr>
              </thead>
              <tbody>
                {model.top_features.map((f) => (
                  <tr key={f.feature}>
                    <td><code>{f.feature}</code></td>
                    <td><strong>{f.importance}</strong></td>
                    {f.normalized_pct !== undefined && <td>{f.normalized_pct}%</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Peer Engine Logic Specification */}
      {model.peer_grouping_columns && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))" }}>
          <p className="section-label" style={{ marginBottom: 6 }}>Cohort &amp; Percentile Specification</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: "0.8rem" }}>
            <div><small className="muted">Peer Columns:</small> <strong>{model.peer_grouping_columns.join(" + ")}</strong></div>
            <div><small className="muted">Cohort Size:</small> <strong>{model.peer_group_size}</strong></div>
            <div style={{ gridColumn: "1 / -1" }}><small className="muted">Percentile Logic:</small> <span>{model.percentile_definition}</span></div>
            <div style={{ gridColumn: "1 / -1" }}><small className="muted">Fallback Logic:</small> <span>{model.fallback_behavior}</span></div>
          </div>
        </div>
      )}

      {/* Operational Threshold */}
      {model.threshold_rationale && (
        <div className="notice notice-gold" style={{ marginTop: 12, fontSize: "0.82rem" }}>
          <strong>Operational Threshold Policy:</strong> {model.threshold_rationale}
        </div>
      )}

      {/* Documented Metrics */}
      {metricEntries(model.documented_metrics).length > 0 && (
        <>
          <p className="section-label" style={{ marginTop: 14 }}>Documented Metrics &amp; Evaluation</p>
          <div className="metric-chip-grid">
            {metricEntries(model.documented_metrics).map(([key, value]) => (
              <span className="metric-chip" key={key}>
                {key.replaceAll("_", " ")}: <strong>{value}</strong>
              </span>
            ))}
          </div>
        </>
      )}

      <p className="section-label" style={{ marginTop: 14 }}>Known Boundaries &amp; Limitations</p>
      <ReasonList items={model.limitations} />

      <div className="panel-footer" style={{ marginTop: 14 }}>
        <SourceBadge /> Documented registry specifications &amp; offline evaluations.
      </div>
    </article>
  );
}

export default function ModelsPage() {
  const resource = useApi<PageResult<RegistryModel>>("/api/v1/admin/models");
  return <>
    <PageHeader eyebrow="RESPONSIBLE AI" title="AI Models & Decision Rules" description="Verified capability metadata and documented evaluation values from the supplied registry. No confidence, SHAP, or unsupported metrics are inferred here." actions={<><SyntheticBadge /><SourceBadge>Verified registry API</SourceBadge></>} />
    {resource.status === "loading" && <LoadingState label="Loading verified model registry" />}
    {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
    {resource.status === "success" && resource.data.items.length === 0 && <EmptyState title="Registry unavailable" detail="The model registry API returned no capability records." />}
    {resource.status === "success" && <>
      <div className="registry-group-label"><span>Predictive AI Models</span><i /> Merchant Demand · Merchant Inactivity · Agent Liquidity</div>
      <div className="model-grid">{resource.data.items.filter((model) => model.engine_type.startsWith("ML:")).map((model) => <ModelCard model={model} key={model.capability} />)}</div>
      <div className="registry-group-label"><span>Decision Engines</span><i /> Rule, peer, and percentile decision support · not trained ML</div>
      <div className="model-grid">{resource.data.items.filter((model) => !model.engine_type.startsWith("ML:")).map((model) => <ModelCard model={model} key={model.capability} />)}</div>
      <section className="panel panel-pad responsible-wrap"><p className="eyebrow">GOVERNANCE POSTURE</p><h2>Responsible intelligence, visibly bounded</h2><div className="responsible-panel">{responsibleItems.map(({ icon: Icon, title, detail }) => <div className="responsible-item" key={title}><Icon size={15} /><span><strong>{title}</strong><br />{detail}</span></div>)}</div></section>
      <section className="panel panel-pad" style={{ marginTop: 24 }}>
        <p className="eyebrow">PRODUCTION ROADMAP</p>
        <h2>What Data We Would Need in Production</h2>
        <p className="muted text-small" style={{ marginBottom: 16 }}>
          Explicit distinction between Current Synthetic Data and Production Upay Data Requirements.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data Domain</th>
                <th><span className="badge badge-warning">CURRENT SYNTHETIC DATA</span></th>
                <th><span className="badge badge-success">PRODUCTION UPAY DATA REQUIRED</span></th>
                <th>Operational Impact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Agent Live Float Balance</strong></td>
                <td>Batch capacity proxy (liquidity_limit) only; static snapshot</td>
                <td>Real-time core banking / MFS ledger balance stream per agent wallet</td>
                <td>Prevent intraday cash-out stockouts &amp; trigger automatic rebalancing</td>
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
                <td><strong>Merchant QR &amp; Channel Logs</strong></td>
                <td>Binary flags (qr_enabled, app_enabled) without scan timestamps</td>
                <td>Live Bangla QR scan events &amp; merchant app session logs</td>
                <td>Target inactive QR merchants for field activation &amp; POS replacement</td>
              </tr>
              <tr>
                <td><strong>Field-Visit &amp; CRM Logs</strong></td>
                <td>Future data required (not present in synthetic dataset)</td>
                <td>Territory Officer (TO) GPS check-ins &amp; merchant resolution notes</td>
                <td>Track closed-loop resolution of interventions and officer SLA</td>
              </tr>
              <tr>
                <td><strong>Real GPS &amp; Outlet Geography</strong></td>
                <td>Categorical district / area_type only; no coordinates</td>
                <td>Verified outlet coordinates (lat/long) where permitted</td>
                <td>Spatial routing for cash distribution vans &amp; route optimization</td>
              </tr>
              <tr>
                <td><strong>Holiday &amp; Eid Event Calendar</strong></td>
                <td>Standard calendar dates without festival overlays</td>
                <td>National MFS calendar: Eid-ul-Fitr, Eid-ul-Adha, Pohela Boishakh</td>
                <td>Pre-position liquidity buffers 72 hours before remittance peaks</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>}
  </>;
}
