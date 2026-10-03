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
  return <article className="model-card"><div className="model-card-head"><div><p className="eyebrow">{model.engine_type.startsWith("ML:") ? "MACHINE LEARNING" : "DECISION ENGINE"}</p><h2>{model.capability}</h2><p className="model-engine">{model.engine_type}</p></div><span className="badge badge-synthetic">Synthetic</span></div><div className="model-facts"><span><small>Serving</small>{model.serving_mode}</span><span><small>Horizon</small>{model.horizon ?? "Snapshot"}</span>{model.version && <span><small>Version</small>{model.version}</span>}{model.forecast_scope && <span><small>Scope</small>{model.forecast_scope}</span>}</div>{model.artifact && <p className="muted text-small">Batch source: <code>{model.artifact}</code></p>}{metricEntries(model.documented_metrics).length > 0 && <><p className="section-label">Documented metrics</p><div className="metric-chip-grid">{metricEntries(model.documented_metrics).map(([key, value]) => <span className="metric-chip" key={key}>{key.replaceAll("_", " ")}: <strong>{value}</strong></span>)}</div></>}<p className="section-label">Limitations</p><ReasonList items={model.limitations} /><div className="panel-footer"><SourceBadge /> This record contains documented facts only.</div></article>;
}

export default function ModelsPage() {
  const resource = useApi<PageResult<RegistryModel>>("/api/v1/admin/models");
  return <>
    <PageHeader eyebrow="RESPONSIBLE AI / 06" title="Models & engines" description="Verified capability metadata and documented evaluation values from the supplied registry. No confidence, SHAP, or unsupported metrics are inferred here." actions={<><SyntheticBadge /><SourceBadge>Verified registry API</SourceBadge></>} />
    {resource.status === "loading" && <LoadingState label="Loading verified model registry" />}
    {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
    {resource.status === "success" && resource.data.items.length === 0 && <EmptyState title="Registry unavailable" detail="The model registry API returned no capability records." />}
    {resource.status === "success" && <>
      <div className="registry-group-label"><span>ML MODELS</span><i /> Merchant Demand · Merchant Churn · Agent Liquidity</div>
      <div className="model-grid">{resource.data.items.filter((model) => model.engine_type.startsWith("ML:")).map((model) => <ModelCard model={model} key={model.capability} />)}</div>
      <div className="registry-group-label"><span>RULE / PEER / PERCENTILE ENGINES</span><i /> Decision support · not trained predictive ML</div>
      <div className="model-grid">{resource.data.items.filter((model) => !model.engine_type.startsWith("ML:")).map((model) => <ModelCard model={model} key={model.capability} />)}</div>
      <section className="panel panel-pad responsible-wrap"><p className="eyebrow">GOVERNANCE POSTURE</p><h2>Responsible intelligence, visibly bounded</h2><div className="responsible-panel">{responsibleItems.map(({ icon: Icon, title, detail }) => <div className="responsible-item" key={title}><Icon size={15} /><span><strong>{title}</strong><br />{detail}</span></div>)}</div></section>
    </>}
  </>;
}
