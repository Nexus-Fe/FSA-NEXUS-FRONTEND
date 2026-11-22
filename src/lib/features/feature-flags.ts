/**
 * Runtime feature flags of the front end.
 *
 * A flag only decides whether the front end SHOWS a screen or a menu entry. It never protects data: the back end stays the
 * only guard (role checks, and for the QA time controls the `AdminTimeControls:Enabled` switch plus the Production block).
 * Flags come from the `FEATURES` environment variable of the Next.js server (comma separated), read per request by
 * `/api/features`, so one build can be switched on or off by restarting the server.
 */
export const FEATURE_KEYS = [
  "vouchers",
  "audit",
  "security-alerts",
  "system-health",
  "ledger",
  "reconciliation",
  "time-controls",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Unknown names are dropped, names are trimmed and lower-cased, duplicates removed. An unset or empty value switches everything off. */
export function parseFeatureList(value?: string | null): FeatureKey[] {
  const known = new Set<string>(FEATURE_KEYS);
  const names = (value ?? "").split(",").map((item) => item.trim().toLowerCase());
  return [...new Set(names.filter((item): item is FeatureKey => known.has(item)))];
}

/** Keeps the items that need no feature, or whose feature is enabled. */
export function filterByFeature<T extends { feature?: FeatureKey }>(items: readonly T[], enabled: ReadonlySet<FeatureKey>): T[] {
  return items.filter((item) => !item.feature || enabled.has(item.feature));
}
