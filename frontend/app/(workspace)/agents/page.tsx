"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { EmptyState, ErrorState, FilterSelect, LoadingState, PageHeader, Pagination, RiskBadge, SearchInput, SourceBadge, SyntheticBadge } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { EntityIdentity, PageResult } from "@/lib/types";

export default function AgentsPage() {
  const [query, setQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState("");
  const [agentType, setAgentType] = useState("");
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: "25", offset: String(offset) });
  if (district) params.set("district", district);
  if (status) params.set("status", status);
  if (agentType) params.set("agent_type", agentType);
  const resource = useApi<PageResult<EntityIdentity>>(`/api/v1/agents?${params.toString()}`);
  const items = resource.status === "success" ? resource.data.items : [];
  const visible = useMemo(() => items.filter((agent) => `${agent.agent_id} ${agent.agent_type} ${agent.location_id} ${agent.district}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  return <>
    <PageHeader eyebrow="AGENT NETWORK / 03" title="Agents" description="Canonical synthetic agent identities. Next-day liquidity, performance and operational-review context is loaded on each agent record." actions={<SyntheticBadge />} />
    <div className="toolbar-row"><SearchInput value={query} onChange={setQuery} placeholder="Search agent, type, location" /><FilterSelect label="District" value={district} onChange={(value) => { setDistrict(value); setOffset(0); }} options={["Dhaka", "Barishal", "Rangpur", "Khulna", "Sylhet", "Rajshahi", "Chattogram", "Mymensingh"]} /><FilterSelect label="Agent type" value={agentType} onChange={(value) => { setAgentType(value); setOffset(0); }} options={["Standard", "Retail", "Master"]} /><FilterSelect label="Status" value={status} onChange={(value) => { setStatus(value); setOffset(0); }} options={["Active", "Inactive"]} /><span className="toolbar-spacer" /><SourceBadge>Canonical master API</SourceBadge></div>
    <section className="panel">
      {resource.status === "loading" && <LoadingState label="Loading canonical agents" />}
      {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
      {resource.status === "success" && visible.length === 0 && <EmptyState title="No agents match" detail="Change the search or filters. The API returned no matching records." />}
      {resource.status === "success" && visible.length > 0 && <>
        <div className="table-wrap"><table><thead><tr><th>Agent</th><th>Type</th><th>Location</th><th>Status</th><th>Estimated Capacity</th><th /></tr></thead><tbody>{visible.map((agent) => <tr key={agent.agent_id} onClick={() => window.location.assign(`/agents/${agent.agent_id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") window.location.assign(`/agents/${agent.agent_id}`); }}><td><strong className="table-primary">{String(agent.agent_id)}</strong></td><td>{String(agent.agent_type ?? "—")}</td><td>{String(agent.district ?? "—")} · {String(agent.location_id ?? "—")}</td><td><RiskBadge value={String(agent.status ?? "Not supplied")} /></td><td>{agent.liquidity_limit_capacity_proxy !== undefined ? Number(agent.liquidity_limit_capacity_proxy).toLocaleString() : "Not supplied"}</td><td><Link href={`/agents/${agent.agent_id}`} className="icon-button" aria-label={`Open ${String(agent.agent_id)}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div>
        <div className="mobile-row-list">{visible.map((agent) => <Link className="mobile-data-row" href={`/agents/${agent.agent_id}`} key={agent.agent_id}><div><strong>{String(agent.agent_id)}</strong><p className="muted">{String(agent.agent_type ?? "Type unavailable")} · {String(agent.district ?? "District unavailable")}</p><small className="muted">{String(agent.location_id ?? "Location unavailable")}</small></div><ArrowUpRight size={16} /></Link>)}</div>
        <Pagination total={resource.data.total} limit={resource.data.limit} offset={offset} onChange={setOffset} />
      </>}
    </section>
    <div className="notice notice-warning" style={{ marginTop: 14 }}>Capacity estimate — not live wallet or cash balance.</div>
  </>;
}
