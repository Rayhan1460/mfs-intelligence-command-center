"use client";

import Link from "next/link";
import { ArrowRight, Activity, Building2, MapPinned, UsersRound } from "lucide-react";

import { AnimatedSection, CountDisplay, EmptyState, ErrorState, HumanReviewBadge, LoadingState, PageHeader, RiskBadge, SourceBadge, StateCard, SyntheticBadge } from "@/components/ui";
import { record } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import type { EntityIdentity, Intervention, PageResult } from "@/lib/types";

interface ForecastResponse extends PageResult<Record<string, unknown>> { forecast_scope?: string; horizon?: string; limitations?: string[] }
interface LocationResponse extends PageResult<Record<string, unknown>> { limitations?: string[] }

export default function CommandCenterPage() {
  const merchants = useApi<PageResult<EntityIdentity>>("/api/v1/merchants?limit=1");
  const agents = useApi<PageResult<EntityIdentity>>("/api/v1/agents?limit=1");
  const demand = useApi<ForecastResponse>("/api/v1/demand/forecasts?limit=100");
  const locations = useApi<LocationResponse>("/api/v1/locations/opportunities?limit=100");
  const interventions = useApi<PageResult<Intervention>>("/api/v1/interventions?limit=8");
  const firstMerchant = merchants.status === "success" ? merchants.data.items[0]?.merchant_id : undefined;
  const firstAgent = agents.status === "success" ? agents.data.items[0]?.agent_id : undefined;
  const benchmark = useApi<Record<string, unknown>>(firstMerchant ? `/api/v1/merchants/${firstMerchant}/benchmark` : null);
  const churn = useApi<Record<string, unknown>>(firstMerchant ? `/api/v1/merchants/${firstMerchant}/churn-risk` : null);
  const growth = useApi<Record<string, unknown>>(firstMerchant ? `/api/v1/merchants/${firstMerchant}/recommendations` : null);
  const liquidity = useApi<Record<string, unknown>>(firstAgent ? `/api/v1/agents/${firstAgent}/liquidity-forecast` : null);
  const performance = useApi<Record<string, unknown>>(firstAgent ? `/api/v1/agents/${firstAgent}/performance` : null);

  const loading = [merchants, agents, demand, locations].some((state) => state.status === "loading");
  const failures = [merchants, agents, demand, locations].filter((state) => state.status === "error");
  if (loading) return <><PageHeader eyebrow="OPERATIONS INTELLIGENCE" title="Command Center" description="Synthetic network signals, validated batch outputs, and decisions kept in human hands." /><LoadingState label="Loading validated intelligence sources" /></>;

  const merchantTotal = merchants.status === "success" ? merchants.data.total : 0;
  const agentTotal = agents.status === "success" ? agents.data.total : 0;
  const locationTotal = locations.status === "success" ? locations.data.total : 0;
  const latestForecast = demand.status === "success" ? demand.data.items.reduce<Record<string, unknown> | undefined>((latest, row) => !latest || String(row.target_date ?? "") > String(latest.target_date ?? "") ? row : latest, undefined) : undefined;
  const latestLocation = locations.status === "success" ? locations.data.items[0] : undefined;
  const capabilityStates: [string, string, string?][] = [
    ["Merchant Demand", demand.status === "success" ? `${demand.data.total} category-day batch rows` : "Unavailable", demand.status === "success" ? String(demand.data.horizon ?? "next_day") : undefined],
    ["Merchant Churn / Inactivity", churn.status === "success" ? String(churn.data.risk_level ?? churn.data.risk_result ?? "Not supplied") : "Loading entity context", churn.status === "success" ? String(churn.data.horizon ?? "30-day inactivity") : undefined],
    ["Merchant Benchmark", benchmark.status === "success" ? String(benchmark.data.performance_band ?? "Not supplied") : "Loading entity context"],
    ["Growth Recommendation", growth.status === "success" ? String(growth.data.growth_priority ?? "Not supplied") : "Loading entity context"],
    ["Agent Liquidity", liquidity.status === "success" ? String(liquidity.data.risk_level ?? "Not supplied") : "Loading entity context", liquidity.status === "success" ? String(liquidity.data.horizon ?? "next_day") : undefined],
    ["Agent Performance", performance.status === "success" ? String(performance.data.performance_band ?? "Not supplied") : "Loading entity context"],
    ["Location Opportunity", String(latestLocation?.expansion_priority ?? "No batch row")],
  ];

  return <>
    <PageHeader eyebrow="OPERATIONS INTELLIGENCE / 01" title="Command Center" description="A live view of available synthetic batch intelligence. Values appear only where the API supplies them." actions={<><SyntheticBadge /><HumanReviewBadge /></>} />
    {failures.length > 0 && <div className="notice notice-warning" role="status">Some intelligence sources are unavailable. The panels below show returned data only.</div>}
    <section className="hero-kpi-row" aria-label="Synthetic entity totals">
      <div className="metric-card"><div className="metric-label"><Building2 size={14} /> Canonical merchants</div><div className="metric-value">{merchants.status === "success" ? <CountDisplay value={merchantTotal} /> : "—"}</div><div className="metric-foot"><SourceBadge>Canonical master</SourceBadge></div></div>
      <div className="metric-card"><div className="metric-label"><UsersRound size={14} /> Canonical agents</div><div className="metric-value">{agents.status === "success" ? <CountDisplay value={agentTotal} /> : "—"}</div><div className="metric-foot"><SourceBadge>Canonical master</SourceBadge></div></div>
      <div className="metric-card"><div className="metric-label"><Activity size={14} /> Category-day forecasts</div><div className="metric-value">{demand.status === "success" ? <CountDisplay value={demand.data.total} /> : "—"}</div><div className="metric-foot">Category-level · next day</div></div>
      <div className="metric-card"><div className="metric-label"><MapPinned size={14} /> Location indices</div><div className="metric-value">{locations.status === "success" ? <CountDisplay value={locationTotal} /> : "—"}</div><div className="metric-foot">Synthetic schematic · not GPS</div></div>
    </section>
    <div className="command-grid">
      <div className="command-left">
        <AnimatedSection>
          <StateCard title="Intelligence pulse">
            <div className="signal-list">
              {demand.status === "success" && latestForecast && <div className="signal-item"><span className="signal-mark" /><div><strong>{String(latestForecast.merchant_category)} demand · next day</strong><p>Latest supplied category point forecast is {String(latestForecast.predicted_next_day_demand ?? "not supplied")} with {String(latestForecast.demand_level ?? "unclassified")} relative band.</p><small>{String(latestForecast.target_date)} · synthetic batch</small></div><RiskBadge value={String(latestForecast.demand_level ?? "Not supplied")} /></div>}
              {liquidity.status === "success" && <div className="signal-item"><span className="signal-mark" /><div><strong>Agent next-day liquidity</strong><p>{String(liquidity.data.risk_level ?? "Risk level not supplied")} · cash preparation amount and capacity proxy are shown on the agent record.</p><small>{String(liquidity.data.target_date ?? "Target date unavailable")} · {String(record(liquidity.data.model_or_engine_metadata)?.version ?? "batch")}</small></div><RiskBadge value={String(liquidity.data.risk_level ?? "Not supplied")} /></div>}
              {latestLocation && <div className="signal-item"><span className="signal-mark" /><div><strong>Location opportunity index</strong><p>{String(latestLocation.district)} · relative opportunity score {String(latestLocation.location_opportunity_score ?? "not supplied")}.</p><small>Schematic location intelligence · no real GPS</small></div><RiskBadge value={String(latestLocation.expansion_priority ?? "Not supplied")} /></div>}
              {!latestForecast && !latestLocation && liquidity.status !== "success" && <EmptyState title="No current pulse items" detail="No supplied batch signal is available from the loaded sources." />}
            </div>
            <div className="panel-footer"><SourceBadge /> <span>Signals reflect supplied batch data, not real-time production operations.</span></div>
          </StateCard>
        </AnimatedSection>
        <AnimatedSection>
          <StateCard title="Intelligence domains">
            <div className="domain-list">{capabilityStates.map(([name, value, horizon]) => <div className="domain-row" key={name}><span>{name}</span><span className="domain-row-value"><strong>{String(value ?? "—")}</strong>{horizon && <small>{String(horizon)}</small>}</span></div>)}</div>
            <div className="panel-footer">The merchant benchmark/growth and agent performance/liquidity labels above are for the first returned entity only, not portfolio-wide aggregates.</div>
          </StateCard>
        </AnimatedSection>
      </div>
      <div className="command-right">
        <AnimatedSection>
          <StateCard title="What needs attention">
            {interventions.status === "loading" && <LoadingState label="Loading human action queue" />}
            {interventions.status === "error" && <ErrorState message={interventions.error} onRetry={interventions.retry} />}
            {interventions.status === "success" && (interventions.data.items.length ? <div className="signal-list">{interventions.data.items.slice(0, 5).map((item) => <Link href="/interventions" className="signal-item" key={item.id}><span className="signal-mark" /><div><strong>{item.target_type} · {item.target_id}</strong><p>{item.recommended_action}</p><small>{item.capability} · {new Date(item.updated_at).toLocaleDateString()}</small></div><RiskBadge value={item.status} /></Link>)}</div> : <EmptyState title="Queue clear" detail="No intervention records were returned for your account." />)}
            <div className="panel-footer"><Link href="/interventions" className="text-button">Open Action Center <ArrowRight size={13} /></Link></div>
          </StateCard>
        </AnimatedSection>
        <AnimatedSection>
          <StateCard title="Demand snapshot">
            {demand.status === "error" && <ErrorState message={demand.error} onRetry={demand.retry} />}
            {demand.status === "success" && <div className="panel-body"><div className="data-pair-grid"><div className="data-pair"><small>Forecast scope</small><strong>Merchant category</strong></div><div className="data-pair"><small>Horizon</small><strong>Next day</strong></div><div className="data-pair"><small>Latest point</small><strong>{latestForecast ? String(latestForecast.predicted_next_day_demand ?? "Not supplied") : "Not supplied"}</strong></div><div className="data-pair"><small>Target date</small><strong>{latestForecast ? String(latestForecast.target_date) : "Not supplied"}</strong></div></div><p className="muted text-small" style={{ margin: "17px 0 0" }}>No merchant-specific, hourly, or interval forecast is implied.</p></div>}
          </StateCard>
        </AnimatedSection>
        {failures.map((failure, index) => failure.status === "error" ? <ErrorState key={index} message={failure.error} onRetry={failure.retry} /> : null)}
      </div>
    </div>
  </>;
}
