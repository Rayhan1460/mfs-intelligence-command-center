export type DataRecord = Record<string, unknown>;

export function record(value: unknown): DataRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DataRecord : null;
}

export function text(value: unknown, fallback = "Not supplied"): string {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

export function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatNumber(value: unknown): string {
  const number = numeric(value);
  return number === null ? "Not supplied" : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(number);
}

export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "Not supplied";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
