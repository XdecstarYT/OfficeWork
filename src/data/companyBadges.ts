export interface CompanyBadge {
  key: string;
  emoji: string;
  name: string;
  threshold: number;
  description: string;
}

/** Company-wide milestones based on total completed documents - thresholds
 * must match the check_company_badges() Postgres function exactly, since
 * that's what actually grants them server-side. This is display metadata
 * only. */
export const COMPANY_BADGES: CompanyBadge[] = [
  { key: "startup", emoji: "🌱", name: "Startup", threshold: 5, description: "Completed 5 documents." },
  { key: "growing", emoji: "📈", name: "Growing Concern", threshold: 25, description: "Completed 25 documents." },
  { key: "established", emoji: "🏢", name: "Established Firm", threshold: 75, description: "Completed 75 documents." },
  { key: "powerhouse", emoji: "🚀", name: "Powerhouse", threshold: 150, description: "Completed 150 documents." },
  { key: "legendary", emoji: "👑", name: "Legendary", threshold: 300, description: "Completed 300 documents." },
];

export function getCompanyBadge(key: string): CompanyBadge | undefined {
  return COMPANY_BADGES.find((b) => b.key === key);
}
