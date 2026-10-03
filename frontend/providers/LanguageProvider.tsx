"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "bn";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const DICTIONARY: Record<Language, Record<string, string>> = {
  en: {
    // Nav & Shell
    "nav.command_center": "Command Center",
    "nav.merchants": "Merchants",
    "nav.agents": "Agents",
    "nav.locations": "Locations",
    "nav.ai_assistant": "AI Copilot",
    "nav.interventions": "Action Review",
    "nav.models": "AI Models & Decision Rules",
    "shell.workspace": "Workspace",
    "shell.kicker": "MERCHANT & AGENT INTELLIGENCE",
    "shell.latest_data": "LATEST ANALYZED DATA",
    "shell.decision_support": "AI-Assisted Decision Support",
    "shell.review_required": "Review Before Action",
    "shell.synthetic_badge": "Synthetic demo",
    "shell.track": "TRACK 05",
    "shell.track_desc": "Merchant & Agent Intelligence",
    "shell.logout": "Sign out",

    // Command Center
    "cc.title": "Merchant & Agent Intelligence",
    "cc.subtitle": "See demand, merchant health, agent readiness and expansion opportunities in one place.",
    "cc.merchants": "Total Merchants",
    "cc.agents": "Total Agents",
    "cc.demand": "Demand Forecasts",
    "cc.locations": "Locations Analyzed",
    "cc.insights": "Latest Insights",
    "cc.needs_attention": "Needs Attention",
    "cc.demand_scope": "Category-level · next day",
    "cc.schematic_note": "Synthetic schematic · not GPS",
    "cc.open_action_review": "Open Action Review",
    "cc.domains": "Intelligence domains",
    "cc.demand_snapshot": "Demand snapshot",

    // Locations
    "loc.title": "Expansion Opportunities",
    "loc.subtitle": "Identify where additional merchant or agent coverage may create value.",
    "loc.disclaimer": "Schematic intelligence view — not real GPS locations.",
    "loc.schematic_warning": "Schematic view — not real GPS locations. Priority is a relative opportunity index, not an emergency rating.",
    "loc.trust_label": "Synthetic intelligence • Schematic view • Review before action",
    "loc.locations_analyzed": "Locations Analyzed",
    "loc.high_critical": "High / Critical Opportunities",
    "loc.merchant_expansion_signals": "Merchant Expansion Signals",
    "loc.agent_expansion_signals": "Agent Expansion Signals",
    "loc.opportunity_network": "Opportunity Network",
    "loc.selected_location": "Selected Location Intelligence",
    "loc.ranked_list": "Ranked Locations",
    "loc.relative_score": "Relative Opportunity Score",
    "loc.merchant_score": "Merchant Expansion",
    "loc.agent_score": "Agent Expansion",
    "loc.demand_score": "Demand Pressure",
    "loc.overall_score": "Overall Opportunity",
    "loc.district": "District",
    "loc.area_type": "Area Type",
    "loc.priority": "Expansion Priority",
    "loc.recommendation": "Recommended Expansion",
    "loc.choose_node": "Select an opportunity node to inspect its relative indices.",
    "loc.caption": "SCHEMATIC VIEW — NOT REAL GPS LOCATIONS · RELATIVE OPPORTUNITY NETWORK",
    "loc.propose_button": "Create Review Proposal",

    // Common
    "common.search": "Search",
    "common.filter": "Filter",
    "common.status": "Status",
    "common.priority": "Priority",
    "common.recommendation": "Recommendation",
    "common.no_data": "No Data Available",
    "common.unavailable": "Information unavailable",
    "common.create_proposal": "Create Review Proposal",
    "common.estimated_capacity": "Estimated Capacity",
    "common.capacity_note": "Capacity estimate — not live wallet or cash balance.",
    "common.retry": "Retry",

    // AI Copilot
    "ai.title": "MFS Intelligence Copilot",
    "ai.subtitle": "Ask questions about merchants, agents, demand and expansion.",
    "ai.mode_badge": "Grounded intelligence assistant · Synthetic demo",
    "ai.notice": "The Copilot explains outputs from the existing trained models and decision engines. It does not generate new predictions, move money, or take any automatic action.",
    "ai.suggested_label": "Suggested questions:",
    "ai.prompt_merchant": "Explain MRC000001",
    "ai.prompt_agent": "Explain AGT00001",
    "ai.prompt_demand": "Show the demand outlook",
    "ai.prompt_locations": "Show expansion opportunities",
    "ai.prompt_churn": "Explain merchant inactivity risk",
    "ai.prompt_liquidity": "Explain agent liquidity",
    "ai.prompt_models": "What AI models are used?",
    "ai.prompt_summary": "Summarize the intelligence",
    "ai.reviewing": "Reviewing intelligence...",
    "ai.placeholder": "Ask about merchants, agents, demand, expansion...",
    "ai.footer_safety": "AI-assisted · Synthetic data · Review before action",
    "ai.evidence_used": "Evidence used",
    "ai.recommended_next": "Recommended next step:",
  },
  bn: {
    // Nav & Shell
    "nav.command_center": "কমান্ড সেন্টার",
    "nav.merchants": "মার্চেন্ট",
    "nav.agents": "এজেন্ট",
    "nav.locations": "লোকেশন",
    "nav.ai_assistant": "AI সহকারী",
    "nav.interventions": "অ্যাকশন রিভিউ",
    "nav.models": "AI মডেল ও সিদ্ধান্তের নিয়ম",
    "shell.workspace": "ওয়ার্কস্পেস",
    "shell.kicker": "মার্চেন্ট ও এজেন্ট ইন্টেলিজেন্স",
    "shell.latest_data": "সর্বশেষ বিশ্লেষণকৃত ডেটা",
    "shell.decision_support": "AI-সহায়িত সিদ্ধান্ত সহায়তা",
    "shell.review_required": "অ্যাকশনের আগে পর্যালোচনা করুন",
    "shell.synthetic_badge": "সিনথেটিক ডেমো",
    "shell.track": "ট্র্যাক ০৫",
    "shell.track_desc": "মার্চেন্ট ও এজেন্ট ইন্টেলিজেন্স",
    "shell.logout": "সাইন আউট",

    // Command Center
    "cc.title": "মার্চেন্ট ও এজেন্ট ইন্টেলিজেন্স",
    "cc.subtitle": "এক নজরে চাহিদা, মার্চেন্ট স্বাস্থ্য, এজেন্ট প্রস্তুতি এবং সম্প্রসারণের সুযোগ দেখুন।",
    "cc.merchants": "মোট মার্চেন্ট",
    "cc.agents": "মোট এজেন্ট",
    "cc.demand": "চাহিদার পূর্বাভাস",
    "cc.locations": "বিশ্লেষণ করা লোকেশন",
    "cc.insights": "সর্বশেষ ইনসাইট",
    "cc.needs_attention": "মনোযোগ প্রয়োজন",
    "cc.demand_scope": "ক্যাটাগরি ভিত্তিক · পরবর্তী দিন",
    "cc.schematic_note": "সিনথেটিক স্কিম্যাটিক · বাস্তব GPS নয়",
    "cc.open_action_review": "অ্যাকশন রিভিউ খুলুন",
    "cc.domains": "ইন্টেলিজেন্স ডোমেন",
    "cc.demand_snapshot": "চাহিদার সারসংক্ষেপ",

    // Locations
    "loc.title": "সম্প্রসারণের সুযোগ",
    "loc.subtitle": "অতিরিক্ত মার্চেন্ট বা এজেন্ট কভারেজ কোথায় সুযোগ সৃষ্টি করতে পারে তা চিহ্নিত করুন।",
    "loc.disclaimer": "স্কিম্যাটিক ইন্টেলিজেন্স ভিউ — এটি বাস্তব GPS লোকেশন নয়।",
    "loc.schematic_warning": "স্কিম্যাটিক ভিউ — এটি বাস্তব GPS লোকেশন নয়। অগ্রাধিকার একটি আপেক্ষিক সুযোগ সূচক, কোনো জরুরি রেটিং নয়।",
    "loc.trust_label": "সিনথেটিক ইন্টেলিজেন্স • স্কিম্যাটিক ভিউ • পদক্ষেপের পূর্বে পর্যালোচনা করুন",
    "loc.locations_analyzed": "বিশ্লেষণ করা লোকেশন",
    "loc.high_critical": "উচ্চ / জরুরি সুযোগ",
    "loc.merchant_expansion_signals": "মার্চেন্ট সম্প্রসারণ সংকেত",
    "loc.agent_expansion_signals": "এজেন্ট সম্প্রসারণ সংকেত",
    "loc.opportunity_network": "সুযোগের নেটওয়ার্ক",
    "loc.selected_location": "নির্বাচিত লোকেশন ইন্টেলিজেন্স",
    "loc.ranked_list": "র‍্যাংক করা লোকেশন তালিকা",
    "loc.relative_score": "আপেক্ষিক সুযোগ স্কোর",
    "loc.merchant_score": "মার্চেন্ট সম্প্রসারণ",
    "loc.agent_score": "এজেন্ট সম্প্রসারণ",
    "loc.demand_score": "চাহিদার চাপ",
    "loc.overall_score": "সামগ্রিক সুযোগ",
    "loc.district": "জেলা",
    "loc.area_type": "এলাকার ধরণ",
    "loc.priority": "সম্প্রসারণ অগ্রাধিকার",
    "loc.recommendation": "সুপারিশকৃত সম্প্রসারণ",
    "loc.choose_node": "আপেক্ষিক সূচক দেখতে একটি সুযোগ নোড নির্বাচন করুন।",
    "loc.caption": "স্কিম্যাটিক ভিউ — বাস্তব GPS লোকেশন নয় · আপেক্ষিক সুযোগ নেটওয়ার্ক",
    "loc.propose_button": "পর্যালোচনা প্রস্তাব তৈরি করুন",

    // Common
    "common.search": "খুঁজুন",
    "common.filter": "ফিল্টার",
    "common.status": "স্ট্যাটাস",
    "common.priority": "অগ্রাধিকার",
    "common.recommendation": "সুপারিশ",
    "common.no_data": "কোনো ডেটা পাওয়া যায়নি",
    "common.unavailable": "তথ্য অনুপলব্ধ",
    "common.create_proposal": "পর্যালোচনা প্রস্তাব তৈরি করুন",
    "common.estimated_capacity": "আনুমানিক সক্ষমতা",
    "common.capacity_note": "সক্ষমতার প্রাক্কলন — লাইভ ওয়ালেট বা নগদ ব্যালেন্স নয়।",
    "common.retry": "পুনরায় চেষ্টা করুন",

    // AI Copilot
    "ai.title": "MFS ইন্টেলিজেন্স সহকারী",
    "ai.subtitle": "মার্চেন্ট, এজেন্ট, চাহিদা এবং সম্প্রসারণ সম্পর্কে প্রশ্ন জিজ্ঞাসা করুন।",
    "ai.mode_badge": "যাচাইকৃত ইন্টেলিজেন্স সহকারী · সিনথেটিক ডেমো",
    "ai.notice": "সহকারী বিদ্যমান প্রশিক্ষিত মডেল এবং সিদ্ধান্ত ইঞ্জিনের আউটপুট ব্যাখ্যা করে। এটি নতুন কোনো পূর্বাভাস তৈরি করে না, অর্থ স্থানান্তর করে না বা কোনো স্বয়ংক্রিয় পদক্ষেপ গ্রহণ করে না।",
    "ai.suggested_label": "প্রস্তাবিত প্রশ্নাবলী:",
    "ai.prompt_merchant": "MRC000001 ব্যাখ্যা করুন",
    "ai.prompt_agent": "AGT00001 ব্যাখ্যা করুন",
    "ai.prompt_demand": "চাহিদার দৃষ্টিভঙ্গি দেখান",
    "ai.prompt_locations": "সম্প্রসারণের সুযোগগুলো দেখান",
    "ai.prompt_churn": "মার্চেন্ট নিষ্ক্রিয়তার ঝুঁকি ব্যাখ্যা করুন",
    "ai.prompt_liquidity": "এজেন্ট লিকুইডিটি ব্যাখ্যা করুন",
    "ai.prompt_models": "কী কী AI মডেল ব্যবহার করা হয়েছে?",
    "ai.prompt_summary": "ইন্টেলিজেন্সের সারসংক্ষেপ দিন",
    "ai.reviewing": "ইন্টেলিজেন্স পর্যালোচনা করা হচ্ছে...",
    "ai.placeholder": "মার্চেন্ট, এজেন্ট, চাহিদা, সম্প্রসারণ নিয়ে জিজ্ঞাসা করুন...",
    "ai.footer_safety": "AI-সহায়িত · সিনথেটিক ডেটা · পদক্ষেপের পূর্বে পর্যালোচনা করুন",
    "ai.evidence_used": "ব্যবহৃত প্রমাণ",
    "ai.recommended_next": "সুপারিশকৃত পরবর্তী পদক্ষেপ:",
  },
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mfs_lang");
      if (stored === "bn" || stored === "en") {
        setLanguageState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      // Local storage not available (SSR / privacy mode)
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("mfs_lang", lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "bn" : "en");
  };

  const t = (key: string, fallback?: string): string => {
    const dict = DICTIONARY[language];
    if (dict && dict[key]) {
      return dict[key];
    }
    const enDict = DICTIONARY.en;
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return fallback ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return graceful fallback if rendered outside provider
    return {
      language: "en",
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: string, fallback?: string) => DICTIONARY.en[key] ?? fallback ?? key,
    };
  }
  return context;
}
