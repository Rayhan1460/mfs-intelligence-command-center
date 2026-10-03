"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { EmptyState, ErrorState, FilterSelect, PageHeader, Pagination, RiskBadge, SearchInput, SourceBadge, SyntheticBadge, LoadingState } from "@/components/ui";
import { useApi } from "@/lib/useApi";
import type { EntityIdentity, PageResult } from "@/lib/types";

const categories = ["Education", "Electronics", "Fashion", "General Retail", "Grocery", "Healthcare", "Pharmacy", "Restaurant", "Transport", "Utility"];
const sizes = ["Micro", "Small", "Medium", "Large"];
const districts = ["Dhaka", "Barishal", "Rangpur", "Khulna", "Sylhet", "Rajshahi", "Chattogram", "Mymensingh"];

export default function MerchantsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [district, setDistrict] = useState("");
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: "25", offset: String(offset) });
  if (category) params.set("merchant_category", category);
  if (size) params.set("business_size", size);
  if (district) params.set("district", district);
  const resource = useApi<PageResult<EntityIdentity>>(`/api/v1/merchants?${params.toString()}`);
  const items = resource.status === "success" ? resource.data.items : [];
  const visible = useMemo(() => items.filter((merchant) => `${merchant.merchant_id} ${merchant.merchant_category} ${merchant.location_id} ${merchant.district}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  return <>
    <PageHeader eyebrow="MERCHANT NETWORK / 02" title="Merchants" description="Canonical synthetic merchant identities. Risk and opportunity summaries are available on individual records where the API provides them." actions={<SyntheticBadge />} />
    <div className="toolbar-row"><SearchInput value={query} onChange={setQuery} placeholder="Search ID, category, location" /><FilterSelect label="Category" value={category} onChange={(value) => { setCategory(value); setOffset(0); }} options={categories} /><FilterSelect label="Business size" value={size} onChange={(value) => { setSize(value); setOffset(0); }} options={sizes} /><FilterSelect label="District" value={district} onChange={(value) => { setDistrict(value); setOffset(0); }} options={districts} /><span className="toolbar-spacer" /><SourceBadge>Canonical master API</SourceBadge></div>
    <section className="panel">
      {resource.status === "loading" && <LoadingState label="Loading canonical merchants" />}
      {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
      {resource.status === "success" && visible.length === 0 && <EmptyState title="No merchants match" detail="Change the search or category filters. The API returned no matching records." />}
      {resource.status === "success" && visible.length > 0 && <>
        <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Category</th><th>Peer size</th><th>Location</th><th>Status</th><th /></tr></thead><tbody>{visible.map((merchant) => <tr key={merchant.merchant_id} onClick={() => window.location.assign(`/merchants/${merchant.merchant_id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") window.location.assign(`/merchants/${merchant.merchant_id}`); }}><td><strong className="table-primary">{String(merchant.merchant_id)}</strong><br /><span className="muted">{String(merchant.assigned_agent_id ?? "Assigned agent not supplied")}</span></td><td>{String(merchant.merchant_category ?? "—")}</td><td>{String(merchant.business_size ?? "—")}</td><td>{String(merchant.district ?? "—")} · {String(merchant.location_id ?? "—")}</td><td><RiskBadge value={String(merchant.merchant_status ?? "Not supplied")} /></td><td><Link href={`/merchants/${merchant.merchant_id}`} className="icon-button" aria-label={`Open ${String(merchant.merchant_id)}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody></table></div>
        <div className="mobile-row-list">{visible.map((merchant) => <Link className="mobile-data-row" href={`/merchants/${merchant.merchant_id}`} key={merchant.merchant_id}><div><strong>{merchant.merchant_id}</strong><p className="muted">{merchant.merchant_category} · {merchant.business_size}</p><small className="muted">{merchant.district} · {merchant.location_id}</small></div><ArrowUpRight size={16} /></Link>)}</div>
        <Pagination total={resource.data.total} limit={resource.data.limit} offset={offset} onChange={setOffset} />
      </>}
    </section>
    <p className="muted text-small" style={{ marginTop: 13 }}>This list is identity data only. Do not infer churn, forecast, or risk values from missing summaries.</p>
  </>;
}
