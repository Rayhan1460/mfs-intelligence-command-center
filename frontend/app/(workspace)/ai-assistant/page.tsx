"use client";

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Send, Sparkles, BrainCircuit, AlertTriangle, ExternalLink,
  ChevronRight, MessageCircle, Lightbulb, BarChart3, MapPin, Users, Store
} from "lucide-react";
import Link from "next/link";
import { apiFetch, friendlyError, ApiError } from "@/lib/api";
import { AnimatedSection, SyntheticBadge, HumanReviewBadge } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EvidenceItem { source: string; data: Record<string, unknown>; }
interface EntityLink { type: string; id: string; label: string; }
interface SuggestedAction {
  label: string;
  target_type: string;
  target_id: string;
  capability: string;
  reason: string;
  recommendation: string;
}
interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: EvidenceItem[];
  entities?: EntityLink[];
  limitations?: string[];
  suggested_action?: SuggestedAction | null;
  error?: string;
  thinking?: boolean;
}

// ---------------------------------------------------------------------------
// Suggested prompts
// ---------------------------------------------------------------------------
interface PromptConfig {
  key: string;
  query: string;
  defaultLabel: string;
  icon: typeof Store;
  color: string;
}

const SUGGESTED_PROMPTS: PromptConfig[] = [
  { key: "ai.prompt_merchant", query: "Explain MRC000001", defaultLabel: "Explain MRC000001", icon: Store, color: "var(--blue-primary)" },
  { key: "ai.prompt_agent", query: "Explain AGT00001", defaultLabel: "Explain AGT00001", icon: Users, color: "var(--blue-interactive)" },
  { key: "ai.prompt_demand", query: "Show the demand outlook", defaultLabel: "Show the demand outlook", icon: BarChart3, color: "var(--yellow-warm)" },
  { key: "ai.prompt_locations", query: "Show expansion opportunities", defaultLabel: "Show expansion opportunities", icon: MapPin, color: "var(--blue-primary)" },
  { key: "ai.prompt_churn", query: "Explain merchant inactivity risk", defaultLabel: "Explain merchant inactivity risk", icon: Lightbulb, color: "var(--blue-interactive)" },
  { key: "ai.prompt_liquidity", query: "Explain agent liquidity", defaultLabel: "Explain agent liquidity", icon: Lightbulb, color: "var(--yellow-warm)" },
  { key: "ai.prompt_models", query: "What AI models are used?", defaultLabel: "What AI models are used?", icon: BrainCircuit, color: "var(--blue-primary)" },
  { key: "ai.prompt_summary", query: "Summarize the intelligence", defaultLabel: "Summarize the intelligence", icon: Sparkles, color: "var(--blue-interactive)" },
];

// ---------------------------------------------------------------------------
// Entity link helper
// ---------------------------------------------------------------------------
function entityHref(entity: EntityLink): string {
  if (entity.type === "merchant") return `/merchants/${entity.id}`;
  if (entity.type === "agent") return `/agents/${entity.id}`;
  if (entity.type === "location") return `/locations`;
  return "#";
}

// ---------------------------------------------------------------------------
// Animated AI orb
// ---------------------------------------------------------------------------
function AIOrb({ thinking }: { thinking: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="ai-orb-wrap" aria-hidden="true">
      <motion.div
        className="ai-orb"
        animate={reduce ? undefined : thinking
          ? { scale: [1, 1.18, 1], boxShadow: ["0 0 30px rgba(25,118,233,0.3)", "0 0 60px rgba(255,212,59,0.45)", "0 0 30px rgba(25,118,233,0.3)"] }
          : { scale: [1, 1.04, 1], boxShadow: ["0 0 24px rgba(25,118,233,0.18)", "0 0 36px rgba(25,118,233,0.28)", "0 0 24px rgba(25,118,233,0.18)"] }
        }
        transition={{ duration: thinking ? 1.2 : 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <BrainCircuit size={22} />
      </motion.div>
      <motion.div
        className="ai-orb-ring"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="ai-orb-ring ai-orb-ring-2"
        animate={reduce ? undefined : { rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      {thinking && !reduce && (
        <motion.div className="ai-thinking-dots">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ msg, t }: { msg: AssistantMessage; t: (k: string) => string }) {
  const reduce = useReducedMotion();

  if (msg.role === "user") {
    return (
      <motion.div
        className="ai-msg ai-msg-user"
        initial={reduce ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="ai-msg-bubble ai-msg-bubble-user">
          {msg.content}
        </div>
      </motion.div>
    );
  }

  // Thinking state
  if (msg.thinking) {
    return (
      <motion.div
        className="ai-msg ai-msg-assistant"
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <AIOrb thinking={true} />
        <div className="ai-msg-bubble ai-msg-bubble-thinking">
          <div className="ai-thinking-label">
            <motion.span animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
              {t("ai.reviewing")}
            </motion.span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (msg.error) {
    return (
      <motion.div
        className="ai-msg ai-msg-assistant"
        initial={reduce ? false : { opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <AIOrb thinking={false} />
        <div className="ai-msg-bubble ai-msg-bubble-error">
          <AlertTriangle size={15} />
          <span>{msg.error}</span>
        </div>
      </motion.div>
    );
  }

  // Format the answer text (convert **bold** and *italic* markdown)
  const formatted = msg.content
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      // Handle newlines
      return part.split("\n").map((line, j) => (
        <span key={`${i}-${j}`}>{line}{j < part.split("\n").length - 1 ? <br /> : null}</span>
      ));
    });

  return (
    <motion.div
      className="ai-msg ai-msg-assistant"
      initial={reduce ? false : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <AIOrb thinking={false} />
      <div className="ai-answer-wrap">
        {/* Main answer */}
        <div className="ai-msg-bubble ai-msg-bubble-assistant">
          <div className="ai-answer-text">{formatted}</div>
        </div>

        {/* Entity links */}
        {msg.entities && msg.entities.length > 0 && (
          <div className="ai-entities">
            {msg.entities.map((e) => (
              <Link key={e.id} href={entityHref(e)} className="ai-entity-chip">
                {e.label} <ExternalLink size={11} />
              </Link>
            ))}
          </div>
        )}

        {/* Evidence */}
        {msg.evidence && msg.evidence.length > 0 && (
          <details className="ai-evidence">
            <summary>{t("ai.evidence_used")} ({msg.evidence.length})</summary>
            <div className="ai-evidence-list">
              {msg.evidence.map((ev, i) => (
                <div key={i} className="ai-evidence-item">
                  <span className="ai-evidence-source">{ev.source}</span>
                  <span className="ai-evidence-data">
                    {Object.entries(ev.data).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Limitations */}
        {msg.limitations && msg.limitations.length > 0 && (
          <div className="ai-limitations">
            <AlertTriangle size={12} />
            <ul>
              {msg.limitations.slice(0, 3).map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggested action */}
        {msg.suggested_action && (
          <div className="ai-suggested-action">
            <span>{t("ai.recommended_step")}</span>
            <Link href="/interventions" className="ai-action-chip">
              {msg.suggested_action.label} <ChevronRight size={12} />
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="ai-msg-footer">
          <span>{t("common.synthetic_badge")} · {t("common.human_review")}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Welcome state
// ---------------------------------------------------------------------------
function WelcomeScreen({
  onPrompt,
  t,
}: {
  onPrompt: (query: string, label: string) => void;
  t: (k: string) => string;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatedSection className="ai-welcome">
      <div className="ai-welcome-top">
        <AIOrb thinking={false} />
        <div>
          <h1 className="ai-welcome-title">{t("ai.welcome_title")}</h1>
          <p className="ai-welcome-sub">{t("ai.welcome_sub")}</p>
          <div className="ai-mode-badge">
            <span className="pulse-dot-blue" />
            {t("ai.subtitle")}
          </div>
        </div>
      </div>
      <div className="ai-notice">
        <AlertTriangle size={14} />
        <span>{t("ai.disclaimer")}</span>
      </div>
      <p className="ai-prompt-label">{t("ai.suggested_questions")}</p>
      <div className="ai-prompt-chips">
        {SUGGESTED_PROMPTS.map((p) => {
          const displayLabel = t(p.key) || p.defaultLabel;
          return (
            <motion.button
              key={p.key}
              className="ai-prompt-chip"
              onClick={() => onPrompt(p.query, displayLabel)}
              whileHover={reduce ? undefined : { y: -2, scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <p.icon size={14} style={{ color: p.color, flexShrink: 0 }} />
              {displayLabel}
            </motion.button>
          );
        })}
      </div>
    </AnimatedSection>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AIAssistantPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "instant" : "smooth" });
  }, [messages, reduce]);

  async function sendMessage(text: string, customDisplay?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: customDisplay ?? trimmed,
    };
    const thinkingMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      thinking: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput("");
    setBusy(true);

    try {
      const data = await apiFetch<{
        answer: string;
        evidence: EvidenceItem[];
        entities: EntityLink[];
        limitations: string[];
        suggested_action: SuggestedAction | null;
      }>("/api/v1/assistant/chat", {
        method: "POST",
        body: { message: trimmed },
      });

      const assistantMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        evidence: data.evidence,
        entities: data.entities,
        limitations: data.limitations,
        suggested_action: data.suggested_action,
      };
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);
    } catch (err) {
      const errMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        error: friendlyError(err),
      };
      setMessages((prev) => [...prev.slice(0, -1), errMsg]);

      // Handle 401 — session expired
      if (err instanceof ApiError && err.status === 401) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { ...errMsg, error: "Your session has ended. Sign in to continue." },
        ]);
      }
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="ai-page">
      {/* Header */}
      <div className="ai-page-header">
        <div className="ai-page-title-wrap">
          <MessageCircle size={20} className="ai-page-icon" />
          <div>
            <h1 className="ai-page-title">{t("ai.title")}</h1>
            <p className="ai-page-subtitle">{t("ai.subtitle")} · {user?.display_name}</p>
          </div>
        </div>
        <div className="ai-header-badges">
          <SyntheticBadge />
          <HumanReviewBadge />
        </div>
      </div>

      {/* Conversation area */}
      <div className="ai-conversation" role="log" aria-live="polite" aria-label="AI conversation">
        {!hasMessages && (
          <WelcomeScreen
            onPrompt={(query, label) => void sendMessage(query, label)}
            t={t}
          />
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} t={t} />
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Prompt chips when there are messages */}
      {hasMessages && !busy && (
        <div className="ai-quick-chips">
          {SUGGESTED_PROMPTS.slice(0, 4).map((p) => {
            const displayLabel = t(p.key) || p.defaultLabel;
            return (
              <button
                key={p.key}
                className="ai-quick-chip"
                onClick={() => void sendMessage(p.query, displayLabel)}
              >
                <p.icon size={12} />
                {displayLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <form className="ai-composer" onSubmit={handleSubmit} aria-label="Message composer">
        <label htmlFor="ai-input" className="sr-only">{t("ai.title")}</label>
        <textarea
          id="ai-input"
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("ai.placeholder")}
          rows={2}
          maxLength={2000}
          disabled={busy}
          aria-disabled={busy}
        />
        <motion.button
          className="ai-send-btn"
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send message"
          whileHover={reduce ? undefined : { scale: 1.05 }}
          whileTap={reduce ? undefined : { scale: 0.96 }}
        >
          <Send size={18} />
        </motion.button>
      </form>

      {/* Footer notice */}
      <div className="ai-footer-notice">
        <Sparkles size={13} />
        {t("ai.disclaimer")}
      </div>
    </div>
  );
}
