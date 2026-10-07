"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, ClipboardList, X } from "lucide-react";

import { apiFetch, friendlyError } from "@/lib/api";
import { EmptyState, ErrorState, FilterSelect, HumanReviewBadge, LoadingState, PageHeader, RiskBadge, StateCard, SyntheticBadge } from "@/components/ui";
import type { Intervention, PageResult } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/providers/AuthProvider";

const statuses = ["PROPOSED", "APPROVED", "REJECTED", "IN_PROGRESS", "COMPLETED", "DISMISSED"] as const;
const transitions: Record<string, string[]> = { PROPOSED: ["APPROVED", "REJECTED", "DISMISSED"], APPROVED: ["IN_PROGRESS", "DISMISSED"], IN_PROGRESS: ["COMPLETED", "DISMISSED"], REJECTED: [], COMPLETED: [], DISMISSED: [] };

export default function InterventionsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const params = new URLSearchParams({ limit: "100" });
  const resource = useApi<PageResult<Intervention>>(`/api/v1/interventions?${params.toString()}&r=${refreshKey}`);
  const all = resource.status === "success" ? resource.data.items : [];
  const items = status ? all.filter((item) => item.status === status) : all;
  const canPropose = Boolean(user && ["ADMIN", "ANALYST", "REGIONAL_MANAGER"].includes(user.role));
  const canDecide = Boolean(user && ["ADMIN", "REGIONAL_MANAGER"].includes(user.role));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const qTargetType = searchParams.get("target_type");
      const qTargetId = searchParams.get("target_id");
      const qCapability = searchParams.get("capability") || "daily_operations_priority";
      const qAction = searchParams.get("action");
      const qReason = searchParams.get("reason");

      if (qTargetId) {
        const form = document.querySelector(".intervention-form") as HTMLFormElement | null;
        if (form) {
          if (qTargetType) {
            const selectEl = form.elements.namedItem("target_type") as HTMLSelectElement | null;
            if (selectEl) selectEl.value = qTargetType;
          }
          const idInput = form.elements.namedItem("target_id") as HTMLInputElement | null;
          if (idInput) idInput.value = qTargetId;
          const capInput = form.elements.namedItem("capability") as HTMLInputElement | null;
          if (capInput) capInput.value = qCapability;
          if (qAction) {
            const actInput = form.elements.namedItem("recommended_action") as HTMLInputElement | null;
            if (actInput) actInput.value = qAction;
          }
          if (qReason) {
            const reasonInput = form.elements.namedItem("reason") as HTMLTextAreaElement | null;
            if (reasonInput) reasonInput.value = qReason;
          }
        }
      }
    }
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setMessage("");
    setBusyId("create");
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    try {
      const result = await apiFetch<Intervention>("/api/v1/interventions", { method: "POST", body: { target_type: data.get("target_type"), target_id: String(data.get("target_id") ?? "").trim(), capability: String(data.get("capability") ?? "").trim(), recommended_action: String(data.get("recommended_action") ?? "").trim(), reason: String(data.get("reason") ?? "").trim() } });
      setMessage(`Proposal ${result.id} recorded as PROPOSED.`);
      form.reset();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(friendlyError(error));
    } finally {
      setBusyId("");
    }
  }

  async function update(item: Intervention, nextStatus: string) {
    if (!window.confirm(`Record human decision: ${item.status} → ${nextStatus}? This does not execute the recommended action.`)) return;
    setBusyId(item.id);
    setFormError("");
    try {
      await apiFetch(`/api/v1/interventions/${encodeURIComponent(item.id)}`, { method: "PATCH", body: { status: nextStatus } });
      setMessage(`Intervention status recorded as ${nextStatus}. No external action was executed.`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setFormError(friendlyError(error));
    } finally {
      setBusyId("");
    }
  }

  return <>
    <PageHeader eyebrow="ACTION CENTER" title="Action Review" description="A record of proposed, reviewed and completed human decisions. Status changes never trigger external operations." actions={<><SyntheticBadge /><HumanReviewBadge /></>} />
    <div className="notice notice-warning" style={{ marginBottom: 16 }}><ClipboardList size={16} /><span>Proposals do not move money, rebalance cash, suspend merchants, change credit, or call external services.</span></div>
    <div className="status-tabs" aria-label="Filter interventions"><button className={`status-tab ${!status ? "active" : ""}`} onClick={() => setStatus("")}>All ({resource.status === "success" ? resource.data.total : "—"})</button>{statuses.map((value) => <button className={`status-tab ${status === value ? "active" : ""}`} key={value} onClick={() => setStatus(value)}>{value}</button>)}</div>
    {canPropose && <StateCard title="Create Review Proposal"><div className="panel-body"><form className="form-stack intervention-form" onSubmit={create}><div className="form-grid"><label>Target type<select name="target_type" required defaultValue="merchant"><option value="merchant">Merchant</option><option value="agent">Agent</option><option value="location">Location</option></select></label><label>Target ID<input name="target_id" placeholder="Canonical entity ID" required maxLength={80} /></label><label>Capability<input name="capability" placeholder="Capability name" required maxLength={80} /></label><label>Recommended action<input name="recommended_action" placeholder="Human-reviewed action" required maxLength={2000} /></label></div><label>Reason<textarea name="reason" required maxLength={4000} placeholder="Evidence and review context" /></label>{formError && <p className="login-error" role="alert">{formError}</p>}{message && <p className="inline-success" role="status">{message}</p>}<div><button className="button button-primary" disabled={busyId === "create"}>{busyId === "create" ? "Submitting…" : "Create proposed record"}</button></div></form></div></StateCard>}
    {!canPropose && <div className="notice notice-gold" style={{ marginBottom: 16 }}>Your role is read-only for proposals. You can review only intervention records authorized for your account.</div>}
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-heading"><div><p className="eyebrow">WORKFLOW RECORDS</p><h2>Human review queue</h2></div><FilterSelect label="Status" value={status} onChange={setStatus} options={[...statuses]} /></div>
      {resource.status === "loading" && <LoadingState label="Loading intervention records" />}
      {resource.status === "error" && <ErrorState message={resource.error} onRetry={resource.retry} />}
      {resource.status === "success" && items.length === 0 && <EmptyState title="No intervention records" detail="No records were returned for this filter and account scope." />}
      {resource.status === "success" && items.length > 0 && <div className="intervention-list">{items.map((item) => <article className="intervention-card" key={item.id}>
        <div className="intervention-main"><div className="intervention-head"><div><p className="eyebrow">{item.capability} · {item.target_type} / {item.target_id}</p><h3>{item.recommended_action}</h3></div><RiskBadge value={item.status} /></div><p className="muted">{item.reason}</p><div className="intervention-meta"><span>Created {new Date(item.created_at).toLocaleString()}</span><span>Updated {new Date(item.updated_at).toLocaleString()}</span><span>Created by <code>{item.created_by.slice(0, 8)}</code></span>{item.approved_by && <span>Reviewed by <code>{item.approved_by.slice(0, 8)}</code></span>}</div></div>
        <div className="intervention-side"><div className="timeline">{["PROPOSED", "APPROVED", "IN_PROGRESS", "COMPLETED"].map((step) => <div key={step} className={`timeline-step ${item.status === step || (step === "PROPOSED" && item.status !== "PROPOSED") || (step === "APPROVED" && ["IN_PROGRESS", "COMPLETED"].includes(item.status)) || (step === "IN_PROGRESS" && item.status === "COMPLETED") ? "done" : ""}`}><span>{step}</span></div>)}</div>{canDecide && transitions[item.status]?.length > 0 && <div className="decision-buttons">{transitions[item.status].map((nextStatus) => <button key={nextStatus} className={`button button-small ${nextStatus === "REJECTED" || nextStatus === "DISMISSED" ? "" : "button-gold"}`} disabled={busyId === item.id} onClick={() => void update(item, nextStatus)}>{nextStatus === "APPROVED" ? <Check size={13} /> : nextStatus === "REJECTED" ? <X size={13} /> : null}{nextStatus.replaceAll("_", " ")}</button>)}</div>}</div>
      </article>)}</div>}
      {formError && !canPropose && <div className="panel-body"><ErrorState message={formError} /></div>}
    </section>
  </>;
}
