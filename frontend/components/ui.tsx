"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BrainCircuit, ChevronLeft, ChevronRight,
  CircleDot, ClipboardList, Command, Globe, LoaderCircle, LogOut, MapPinned, Menu, MessageCircle,
  Search, ShieldCheck, Sparkles, Store, UsersRound
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { apiFetch, friendlyError } from "@/lib/api";
import type { Intervention, Role } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

export function SyntheticBadge() {
  const { t } = useLanguage();
  return <span className="badge badge-synthetic"><span className="pulse-dot" /> {t("shell.synthetic_badge", "Synthetic demo")}</span>;
}

export function HumanReviewBadge() {
  const { t } = useLanguage();
  return <span className="badge badge-review"><ShieldCheck size={13} /> {t("shell.review_required", "Review Before Action")}</span>;
}

export function SourceBadge({ children }: { children?: ReactNode }) {
  const { t } = useLanguage();
  return <span className="badge badge-source"><CircleDot size={12} />{children ?? t("shell.latest_data", "Latest Analyzed Data")}</span>;
}

export function RiskBadge({ value }: { value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return <span className="muted">No Data Available</span>;
  const text = typeof value === "boolean" ? (value ? "Flagged" : "Clear") : String(value).replaceAll("_", " ");
  const lowered = text.toLowerCase();
  const tone = /critical|high|flagged|declining|needs attention/.test(lowered)
    ? "danger"
    : /medium|moderate|warning|developing/.test(lowered)
      ? "warning"
      : /low|normal|strong|leading|clear|approved|completed/.test(lowered)
        ? "success"
        : "neutral";
  return <span className={`badge badge-${tone}`}>{text}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="page-header-actions">{actions}</div>}</header>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><span className="skeleton skeleton-wide" />{Array.from({ length: rows }, (_, index) => <span className="skeleton" key={index} />)}</div>;
}

export function LoadingState({ label = "Loading verified intelligence" }: { label?: string }) {
  return <div className="state-panel" role="status"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const restricted = /not have access|not authorized|access is restricted/i.test(message);
  return <div className="state-panel state-error" role="alert"><AlertTriangle size={20} /><div><strong>{restricted ? "Access restricted" : "Information unavailable"}</strong><p>{message}</p>{onRetry && <button className="button button-small" onClick={onRetry}>Retry</button>}</div></div>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="state-panel"><Sparkles size={19} /><div><strong>{title}</strong><p>{detail}</p></div></div>;
}

export function SyntheticNotice({ children }: { children: ReactNode }) {
  return <div className="notice notice-gold"><Sparkles size={16} /><span>{children}</span></div>;
}

export function SearchInput({ value, onChange, placeholder = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-field"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (value: number) => void }) {
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return <div className="pagination"><span>{total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : "0 results"}</span><div><button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}><ChevronLeft size={17} /></button><span className="pagination-page">{page} / {pageCount}</span><button className="icon-button" aria-label="Next page" disabled={page >= pageCount} onClick={() => onChange(offset + limit)}><ChevronRight size={17} /></button></div></div>;
}

export function DataTable({ columns, rows, rowKey, onRowClick, selectedKey }: { columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[]; rows: Record<string, unknown>[]; rowKey: string; onRowClick?: (row: Record<string, unknown>) => void; selectedKey?: string }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => {
    const isSelected = selectedKey !== undefined && String(row[rowKey] ?? "") === selectedKey;
    return <tr key={String(row[rowKey] ?? index)} className={isSelected ? "row-selected" : ""} onClick={() => onRowClick?.(row)} tabIndex={onRowClick ? 0 : undefined} onKeyDown={(event) => { if (onRowClick && (event.key === "Enter" || event.key === " ")) onRowClick(row); }}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? "—")}</td>)}</tr>;
  })}</tbody></table></div>;
}

export function AnimatedSection({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.section className={className} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.42, ease: "easeOut" }}>{children}</motion.section>;
}

export function IntelligenceHalo({ kind, segments }: { kind: "merchant" | "agent"; segments: string[] }) {
  const reduce = useReducedMotion();
  return <div className={`intelligence-halo halo-${kind}`} aria-label={`${kind} intelligence domains: ${segments.join(", ")}`}>
    <motion.div className="halo-ring halo-ring-one" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 52, repeat: Infinity, ease: "linear" }} />
    <motion.div className="halo-ring halo-ring-two" animate={reduce ? undefined : { rotate: -360 }} transition={{ duration: 75, repeat: Infinity, ease: "linear" }} />
    <div className="halo-core"><span>{kind === "merchant" ? "M" : "A"}</span><i /></div>
    {segments.map((segment, index) => <span key={segment} className={`halo-label halo-label-${index}`}>{segment}</span>)}
  </div>;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const reduce = useReducedMotion();

  return (
    <div className="lang-switcher" role="group" aria-label="Language selection">
      <Globe size={13} className="lang-icon" aria-hidden="true" />
      <div className="lang-pill">
        <button
          type="button"
          className={`lang-btn ${language === "en" ? "active" : ""}`}
          onClick={() => setLanguage("en")}
          aria-pressed={language === "en"}
        >
          EN
        </button>
        <button
          type="button"
          className={`lang-btn ${language === "bn" ? "active" : ""}`}
          onClick={() => setLanguage("bn")}
          aria-pressed={language === "bn"}
        >
          বাংলা
        </button>
        <motion.span
          className="lang-slider"
          layout
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 32 }}
          style={{
            left: language === "en" ? "2px" : "calc(50% + 1px)",
          }}
        />
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/command-center", key: "command_center", label: "Command Center", icon: Command, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"] },
  { href: "/merchants", key: "merchants", label: "Merchants", icon: Store, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "JUDGE"] },
  { href: "/agents", key: "agents", label: "Agents", icon: UsersRound, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "AGENT", "JUDGE"] },
  { href: "/locations", key: "locations", label: "Locations", icon: MapPinned, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"] },
  { href: "/ai-assistant", key: "ai_assistant", label: "AI Copilot", icon: MessageCircle, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "AGENT", "JUDGE"] },
  { href: "/interventions", key: "interventions", label: "Action Review", icon: ClipboardList, roles: ["ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "AGENT", "JUDGE"] },
  { href: "/models", key: "models", label: "AI Models & Decision Rules", icon: BrainCircuit, roles: ["ADMIN", "JUDGE"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <main className="auth-loading"><LoadingState label="Checking secure session" /></main>;
  if (!user) {
    return <main className="auth-loading"><LoadingState label="Redirecting to secure access" /></main>;
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const activeItem = items.find((item) => pathname.startsWith(item.href));
  const currentTitle = activeItem ? t(`nav.${activeItem.key}`, activeItem.label) : "Intelligence Workspace";

  const nav = <nav className="side-nav" aria-label="Primary navigation">
    <Link className="brand-lockup" href="/command-center">
      <span className="brand-mark">M<span>F</span></span>
      <span className="brand-name">MFS<span>INTELLIGENCE</span></span>
    </Link>
    <div className="nav-section-label">{t("shell.workspace")}</div>
    {items.map((item, index) => {
      const active = pathname.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`nav-link ${active ? "active" : ""}`}
        >
          <span className="nav-index">0{index + 1}</span>
          <span className="nav-icon"><item.icon size={16} aria-hidden="true" /></span>
          <span>{t(`nav.${item.key}`, item.label)}</span>
          {active && <span className="nav-active-pill" aria-hidden="true" />}
        </Link>
      );
    })}
    <div className="sidebar-bottom">
      <SyntheticBadge />
      <div className="sidebar-footnote">{t("shell.track")} <span>{t("shell.track_desc")}</span></div>
    </div>
  </nav>;

  return <div className="app-frame">
    {/* Animated background */}
    <div className="ambient-root" aria-hidden="true" />

    <aside className="sidebar-desktop">{nav}</aside>
    <AnimatePresence>{mobileOpen && <motion.div className="mobile-nav-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)}><motion.aside className="mobile-sidebar" initial={reduce ? false : { x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} onClick={(event) => event.stopPropagation()}>{nav}</motion.aside></motion.div>}</AnimatePresence>

    <div className="workspace-column">
      <header className="topbar">
        <div className="topbar-orbit" aria-hidden="true"><span /><span /><span /></div>
        <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
        <div className="topbar-context">
          <span className="topbar-kicker">{t("shell.kicker")}</span>
          <strong>{currentTitle}</strong>
        </div>
        <div className="topbar-pulse">
          <span className="live-dot" /> {t("shell.latest_data")} <span className="pulse-track"><i /></span>
        </div>

        {/* Animated Language Switcher */}
        <LanguageSwitcher />

        <div className="topbar-profile">
          <div className="profile-avatar">{user.display_name.slice(0, 1).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{user.display_name}</strong>
            <span>{user.role.replaceAll("_", " ")}</span>
          </div>
          <button className="icon-button logout-button" onClick={() => void logout()} aria-label={t("shell.logout")} title={t("shell.logout")}><LogOut size={16} /></button>
        </div>
      </header>
      <div className="global-ribbon">
        <SyntheticBadge />
        <span>{t("shell.decision_support")}</span>
        <span className="ribbon-separator">·</span>
        <HumanReviewBadge />
      </div>
      <main className="workspace-main">
        <AnimatePresence mode="wait">
          <motion.div key={pathname} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduce ? 0 : 0.22 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  </div>;
}

export function InterventionComposer({ targetType, targetId, capability, recommendation, reason }: { targetType: "merchant" | "agent" | "location"; targetId: string; capability: string; recommendation: string; reason: string }) {
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const allowed = user && ["ADMIN", "ANALYST", "REGIONAL_MANAGER"].includes(user.role);
  if (!allowed) return <HumanReviewBadge />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch<Intervention>("/api/v1/interventions", { method: "POST", body: { target_type: targetType, target_id: targetId, capability, recommended_action: String(data.get("action") ?? recommendation), reason: String(data.get("reason") ?? reason) } });
      setMessage("Proposal recorded for human review.");
      setOpen(false);
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button className="button button-gold" onClick={() => setOpen(true)}>Create Review Proposal <ArrowUpRight size={15} /></button>
    <AnimatePresence>{open && <motion.div className="dialog-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><motion.div className="dialog" role="dialog" aria-modal="true" aria-labelledby="intervention-title" initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><button className="dialog-close icon-button" onClick={() => setOpen(false)} aria-label="Close">×</button><p className="eyebrow">ACTION REVIEW</p><h2 id="intervention-title">Create Review Proposal</h2><p className="muted">This records a proposal only. Nothing here moves money or changes merchant, agent or customer status automatically.</p><form onSubmit={submit} className="form-stack"><label>Recommended action<textarea name="action" required defaultValue={recommendation} maxLength={2000} /></label><label>Reason for review<textarea name="reason" required defaultValue={reason} maxLength={4000} /></label>{message && <p className="form-message">{message}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Submitting…" : "Submit proposal"}</button></form></motion.div></motion.div>}</AnimatePresence>
    {message && !open && <span className="inline-success">{message}</span>}
  </>;
}

export function FeedbackForm({ entityType, entityId, capability }: { entityType: "merchant" | "agent" | "location"; entityId: string; capability: string }) {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const canSend = user && ["ADMIN", "ANALYST"].includes(user.role);
  if (!canSend) return null;

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await apiFetch("/api/v1/feedback", { method: "POST", body: { entity_type: entityType, entity_id: entityId, capability, helpful: helpful ?? undefined, rating: rating ? Number(rating) : undefined, comment: comment.trim() || undefined, intelligence_reference: { source: "synthetic" } } });
      setSent(true);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return <div className="feedback-control"><span>Analyst feedback</span>{sent ? <span className="inline-success">Recorded for future review; no automatic retraining.</span> : <form className="feedback-form" onSubmit={send}><div className="feedback-choice"><button type="button" className={`text-button ${helpful === true ? "chosen" : ""}`} aria-pressed={helpful === true} onClick={() => setHelpful(true)}>Helpful</button><button type="button" className={`text-button ${helpful === false ? "chosen" : ""}`} aria-pressed={helpful === false} onClick={() => setHelpful(false)}>Not helpful</button></div><label className="feedback-rating">Rating<select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">No rating</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} / 5</option>)}</select></label><label className="feedback-comment"><span className="sr-only">Optional comment</span><input maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional review note" /></label><button className="button button-small" disabled={busy || (helpful === null && !rating && !comment.trim())}>{busy ? "Sending…" : "Send feedback"}</button></form>}{error && <small className="form-error">{error}</small>}</div>;
}

export function MetricValue({ value, unit }: { value: unknown; unit?: string }) {
  if (value === null || value === undefined || value === "") return <span className="metric-unavailable">No Data Available</span>;
  if (typeof value !== "number") return <span>{String(value)}</span>;
  return <span>{new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)}{unit ? <small>{unit}</small> : null}</span>;
}

export function DirectionMark({ value }: { value?: number | null }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={value >= 0 ? "tone-success" : "tone-warning"}><Icon size={14} />{value}%</span>;
}

export function StateCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel"><div className="panel-heading"><h2>{title}</h2></div>{children}</section>;
}

export function SignalLine() {
  return <div className="signal-line" aria-hidden="true"><span /><i /><b /></div>;
}

export function ReasonList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="muted">No explanation supplied.</p>;
  return <ul className="reason-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function StaleDataBanner({ asOf }: { asOf?: string }) {
  return <div className="notice notice-warning"><AlertTriangle size={15} /><span>Showing the latest validated batch result{asOf ? ` as of ${asOf}` : ""}. It may not reflect current conditions.</span></div>;
}

export function CountDisplay({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 75, damping: 22 });
  const rounded = useTransform(spring, (latest) => new Intl.NumberFormat().format(Math.round(latest)));
  useEffect(() => { motionValue.set(value); }, [motionValue, value]);
  if (reduce) return <span>{new Intl.NumberFormat().format(value)}</span>;
  return <motion.span aria-label={new Intl.NumberFormat().format(value)}>{rounded}</motion.span>;
}

export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export type RoleGate = Role[];