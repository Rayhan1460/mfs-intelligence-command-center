"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { HumanReviewBadge, SyntheticBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";

const domains = [
  ["01", "Next-day demand", "Category-level point forecasts, clearly scoped to the merchant category."],
  ["02", "Inactivity risk", "Batch signals with the deterministic 30-day label limitation in view."],
  ["03", "Peer intelligence", "Benchmark and growth decision support without causal claims."],
  ["04", "Liquidity preparation", "Validated next-day cash-out context, never live wallet telemetry."],
  ["05", "Network performance", "Peer-relative agent performance and operational review signals."],
  ["06", "Human-reviewed actions", "Proposals and decisions remain controlled by authorized people."],
];

function EcosystemNetwork() {
  const reduce = useReducedMotion();
  return <svg className="ecosystem-svg" viewBox="0 0 680 520" role="img" aria-label="Schematic connection between merchant, agent, location and intelligence nodes">
    <defs>
      <radialGradient id="coreGradient"><stop stopColor="#dfc277" stopOpacity=".28" /><stop offset="1" stopColor="#131a16" stopOpacity=".94" /></radialGradient>
      <linearGradient id="lineGradient"><stop stopColor="#9f8951" stopOpacity="0" /><stop offset=".5" stopColor="#f0d48a" stopOpacity=".9" /><stop offset="1" stopColor="#9f8951" stopOpacity="0" /></linearGradient>
    </defs>
    <circle className="network-ring network-ring-outer" cx="345" cy="260" r="218" />
    <circle className="network-ring" cx="345" cy="260" r="155" />
    <path className="network-link" d="M345 260 155 132M345 260 537 120M345 260 552 350M345 260 168 389M155 132 95 266M537 120 582 238M552 350 465 445M168 389 85 300M155 132 313 64M537 120 398 55M168 389 303 458" />
    <path className="network-link network-link-muted" d="M95 266 345 260M582 238 345 260M465 445 345 260M85 300 345 260" />
    {!reduce && <>
      <circle r="3" className="network-pulse"><animateMotion dur="4.5s" repeatCount="indefinite" path="M155 132 345 260" /></circle>
      <circle r="2.5" className="network-pulse"><animateMotion dur="5.8s" begin="1.2s" repeatCount="indefinite" path="M552 350 345 260" /></circle>
      <circle r="2.5" className="network-pulse"><animateMotion dur="6.2s" begin="2s" repeatCount="indefinite" path="M85 300 345 260" /></circle>
    </>}
    <circle className="network-core" cx="345" cy="260" r="52" />
    <circle className="network-orbit" cx="345" cy="208" r="3" />
    <text className="network-label-core" x="345" y="254" textAnchor="middle">INTELLIGENCE</text>
    <text className="network-label-core" x="345" y="269" textAnchor="middle">COMMAND CORE</text>
    <circle className="network-node" cx="155" cy="132" r="20" /><text className="network-label" x="155" y="137" textAnchor="middle">M</text><text className="network-label" x="155" y="103" textAnchor="middle">MERCHANT</text>
    <circle className="network-node network-node-agent" cx="537" cy="120" r="20" /><text className="network-label" x="537" y="125" textAnchor="middle">A</text><text className="network-label" x="537" y="91" textAnchor="middle">AGENT</text>
    <circle className="network-node" cx="552" cy="350" r="17" /><text className="network-label" x="552" y="354" textAnchor="middle">L</text><text className="network-label" x="552" y="380" textAnchor="middle">LOCATION</text>
    <circle className="network-node network-node-agent" cx="168" cy="389" r="16" /><text className="network-label" x="168" y="393" textAnchor="middle">A</text>
    <circle className="network-node" cx="95" cy="266" r="7" /><circle className="network-node" cx="582" cy="238" r="7" /><circle className="network-node" cx="465" cy="445" r="7" /><circle className="network-node" cx="85" cy="300" r="5" />
    <path d="M314 64h58" stroke="url(#lineGradient)" strokeWidth="1" opacity=".6" />
    <text className="network-label" x="345" y="52" textAnchor="middle">BATCH SIGNALS · SYNTHETIC</text>
  </svg>;
}

export default function LandingPage() {
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const destination = user ? "/command-center" : "/login";
  return <main className="hero-page">
    <header className="hero-top">
      <Link className="brand-lockup" href="/"><span className="brand-mark">M<span>F</span></span><span className="brand-name">MFS<span>INTELLIGENCE</span></span></Link>
      <div className="hero-top-actions"><span>TRACK 05</span><Link className="button button-small" href={destination}>{user ? "Open workspace" : "Secure access"}<ArrowRight size={13} /></Link></div>
    </header>
    <section className="hero-content">
      <motion.div className="hero-copy" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .7 }}>
        <p className="eyebrow">TRACK 05 — MERCHANT & AGENT INTELLIGENCE</p>
        <h1>MFS Intelligence <em>Ecosystem</em></h1>
        <p className="hero-lede">A synthetic-data command center that brings forecasts, peer signals and operational context into one place, with every consequential action kept in human hands.</p>
        <div className="hero-cta-row"><Link href={destination} className="button button-gold">Enter Command Center <ArrowRight size={16} /></Link><a className="button button-quiet" href="#intelligence">Explore intelligence <ArrowDown size={14} /></a></div>
        <div className="hero-proof"><SyntheticBadge /><HumanReviewBadge /></div>
      </motion.div>
      <motion.div className="hero-visual" initial={reduce ? false : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduce ? 0 : 1, delay: .1 }}>
        <EcosystemNetwork />
        <div className="hero-note"><span /> SCHEMATIC NETWORK · NOT GEOGRAPHIC</div>
      </motion.div>
    </section>
    <section className="capability-band" aria-label="Intelligence capability areas"><div className="capability-inner"><div className="capability-cell"><strong>Signals become<br />reviewable decisions.</strong><span>One operating picture for Track 05.</span></div><div className="capability-cell"><strong>Forecasts</strong><span>Category demand · next day</span></div><div className="capability-cell"><strong>Risk & opportunity</strong><span>Inactivity · growth · benchmarks</span></div><div className="capability-cell"><strong>Network readiness</strong><span>Liquidity · performance · locations</span></div><div className="capability-cell"><strong>Human oversight</strong><span>Propose · review · record</span></div></div></section>
    <section className="landing-section" id="intelligence"><p className="eyebrow">SEVEN CAPABILITIES · ONE REVIEW LOOP</p><h2>Intelligence that keeps its limits in view.</h2><div className="landing-section-grid">{domains.map(([index, title, description]) => <motion.article key={index} className="landing-domain" initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .3 }} transition={{ duration: reduce ? 0 : .38, delay: reduce ? 0 : Number(index) * .035 }}><span>{index} / SIGNAL DOMAIN</span><h3>{title}</h3><p>{description}</p></motion.article>)}</div></section>
    <footer className="hero-footer"><span>All supplied intelligence is synthetic.</span><span><ShieldCheck size={13} /> Consequential actions require human review.</span></footer>
  </main>;
}
