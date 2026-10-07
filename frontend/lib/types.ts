export type Role =
  | "ADMIN"
  | "ANALYST"
  | "REGIONAL_MANAGER"
  | "MERCHANT"
  | "AGENT"
  | "JUDGE";

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  [key: string]: unknown;
}

export interface EntityIdentity {
  merchant_id?: string;
  agent_id?: string;
  merchant_category?: string;
  business_size?: string;
  location_id?: string;
  district?: string;
  area_type?: string;
  agent_type?: string;
  merchant_status?: string;
  status?: string;
  [key: string]: unknown;
}

export interface Intervention {
  id: string;
  target_type: "merchant" | "agent" | "location";
  target_id: string;
  capability: string;
  recommended_action: string;
  reason: string;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistryModel {
  capability: string;
  engine_type: string;
  serving_mode: string;
  horizon: string | null;
  forecast_scope?: string;
  artifact: string;
  version: string | null;
  documented_metrics: Record<string, string | number | Record<string, string>>;
  limitations: string[];
  synthetic_data: boolean;
}

export interface ApiFailure {
  code: string;
  message: string;
  correlation_id?: string;
  safe_details?: Record<string, unknown>;
}

export interface PriorityActionItem {
  priority_rank: number;
  priority_score: number;
  priority_level: "HIGH" | "MEDIUM" | "LOW";
  entity_id: string;
  entity_type: "agent" | "merchant";
  entity_name_or_category: string;
  district: string;
  location_id?: string | null;
  reason: string;
  evidence: string;
  recommended_action: string;
  expected_value_label: string;
  confidence_label: string;
  source_modules: string[];
  review_status: string;
  intervention_id?: string | null;
  future_data_required: string[];
}

export interface MorningBriefing {
  as_of_date: string;
  total_actions_flagged: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  agent_cases_count: number;
  merchant_cases_count: number;
  top_operational_reason: string;
  top_recommended_action: string;
  briefing_text_en: string;
  briefing_text_bn: string;
}

export interface DailyPrioritiesResponse {
  source: string;
  synthetic_data: boolean;
  serving_mode: string;
  scoring_formula: string;
  briefing: MorningBriefing;
  items: PriorityActionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProductionDataRequirement {
  data_domain: string;
  current_synthetic_status: string;
  production_upay_requirement: string;
  operational_purpose: string;
}