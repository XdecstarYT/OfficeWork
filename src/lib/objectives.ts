import { supabase } from "./supabaseClient";
import { awardMoney, awardXp } from "./company";
import { payoutForStat, type DocumentStatRow } from "./documents";
import type { Database } from "../types/database";

export type ObjectiveClaimRow = Database["public"]["Tables"]["objective_claims"]["Row"];

export type ObjectivePeriod = "daily" | "weekly";

/** What a member has to do, measured against the company's document history. */
type ObjectiveMetric =
  | "complete" // documents you completed
  | "earn" // money you earned from completed work
  | "submit" // documents you submitted for review
  | "assign" // work you handed to someone else
  | "variety"; // distinct template categories you completed in

export interface ObjectiveDef {
  /** Stable within a period, so a claim survives a reload. */
  key: string;
  period: ObjectivePeriod;
  metric: ObjectiveMetric;
  target: number;
  title: string;
  description: string;
  emoji: string;
  rewardMoney: number;
  rewardXp: number;
}

export interface ObjectiveProgress extends ObjectiveDef {
  progress: number;
  complete: boolean;
  claimed: boolean;
}

/**
 * A tiny deterministic hash. The objective set has to be identical for every
 * player in a company on a given day - and identical across reloads - without
 * a server round trip to generate it, so the daily seed is derived from the
 * company id and the date rather than from Math.random().
 */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Local calendar date, so "today" means the player's today. */
export function dayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** ISO-ish week key: the Monday that starts the current week. */
export function weekKey(now = new Date()): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay() is 0 for Sunday, which belongs to the week that started 6 days ago.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return `W${dayKey(monday)}`;
}

export function startOfDay(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function startOfWeek(now = new Date()): Date {
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

interface ObjectiveTemplate {
  metric: ObjectiveMetric;
  emoji: string;
  title: (target: number) => string;
  description: (target: number) => string;
  /** Daily targets; the weekly set multiplies these. */
  targets: number[];
  moneyPerUnit: number;
  xpPerUnit: number;
}

const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  {
    metric: "complete",
    emoji: "✅",
    title: (n) => `Clear ${n} task${n === 1 ? "" : "s"}`,
    description: (n) => `Finish ${n} document${n === 1 ? "" : "s"} end to end.`,
    targets: [2, 3, 4, 5],
    moneyPerUnit: 8,
    xpPerUnit: 6,
  },
  {
    metric: "earn",
    emoji: "💵",
    title: (n) => `Earn $${n}`,
    description: (n) => `Bank $${n} in payouts from completed work.`,
    targets: [40, 60, 80, 120],
    moneyPerUnit: 0.25,
    xpPerUnit: 0.15,
  },
  {
    metric: "submit",
    emoji: "📤",
    title: (n) => `Submit ${n} for review`,
    description: (n) => `Hand ${n} document${n === 1 ? "" : "s"} to a reviewer.`,
    targets: [2, 3, 4],
    moneyPerUnit: 7,
    xpPerUnit: 5,
  },
  {
    metric: "assign",
    emoji: "📌",
    title: (n) => `Delegate ${n} task${n === 1 ? "" : "s"}`,
    description: (n) => `Assign ${n} piece${n === 1 ? "" : "s"} of work to a coworker or AI coworker.`,
    targets: [1, 2, 3],
    moneyPerUnit: 12,
    xpPerUnit: 8,
  },
  {
    metric: "variety",
    emoji: "🎯",
    title: (n) => `Work across ${n} categories`,
    description: (n) => `Complete work from ${n} different filing categories.`,
    targets: [2, 3],
    moneyPerUnit: 20,
    xpPerUnit: 15,
  },
];

const DAILY_COUNT = 3;
const WEEKLY_COUNT = 2;
const WEEKLY_MULTIPLIER = 4;

function buildObjectives(seedInput: string, period: ObjectivePeriod, count: number): ObjectiveDef[] {
  const seed = hash(seedInput);
  const pool = [...OBJECTIVE_TEMPLATES];
  const picked: ObjectiveDef[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const template = pool.splice(hash(`${seedInput}:${i}`) % pool.length, 1)[0];
    const baseTarget = template.targets[hash(`${seedInput}:${i}:t`) % template.targets.length];
    const target = period === "weekly" ? baseTarget * WEEKLY_MULTIPLIER : baseTarget;
    picked.push({
      key: `${seedInput}:${template.metric}:${target}`,
      period,
      metric: template.metric,
      target,
      title: template.title(target),
      description: template.description(target),
      emoji: template.emoji,
      rewardMoney: Math.round(target * template.moneyPerUnit),
      rewardXp: Math.round(target * template.xpPerUnit),
    });
  }
  // Seed is folded in above; referencing it here keeps the intent explicit
  // that the whole set is a pure function of the period + company.
  void seed;
  return picked;
}

export function objectivesFor(companyId: string, now = new Date()): ObjectiveDef[] {
  return [
    ...buildObjectives(`${companyId}:${dayKey(now)}`, "daily", DAILY_COUNT),
    ...buildObjectives(`${companyId}:${weekKey(now)}`, "weekly", WEEKLY_COUNT),
  ];
}

/** Category for a completed document, used by the "variety" objective. */
function categoryOf(doc: DocumentStatRow): string {
  return doc.template_id?.replace(/-\d+$/, "") ?? doc.title;
}

function measure(
  def: ObjectiveDef,
  docs: DocumentStatRow[],
  memberId: string,
  since: number,
  bonusPercent: number,
): number {
  const mine = docs.filter((d) => d.assigned_to === memberId);
  const completed = mine.filter(
    (d) => d.status === "completed" && d.completed_at && new Date(d.completed_at).getTime() >= since,
  );
  switch (def.metric) {
    case "complete":
      return completed.length;
    case "earn":
      return Math.round(completed.reduce((sum, d) => sum + payoutForStat(d, bonusPercent), 0));
    case "submit":
      return mine.filter(
        (d) =>
          ["submitted", "pending_approval", "approved", "completed"].includes(d.status) &&
          new Date(d.updated_at).getTime() >= since,
      ).length;
    case "assign":
      return docs.filter(
        (d) =>
          d.created_by === memberId &&
          (d.assigned_to !== memberId || d.assigned_to_npc_id) &&
          new Date(d.created_at).getTime() >= since,
      ).length;
    case "variety":
      return new Set(completed.map(categoryOf)).size;
  }
}

export function evaluateObjectives(params: {
  defs: ObjectiveDef[];
  docs: DocumentStatRow[];
  memberId: string;
  claimedKeys: Set<string>;
  bonusPercent?: number;
  now?: Date;
}): ObjectiveProgress[] {
  const { defs, docs, memberId, claimedKeys, bonusPercent = 0, now = new Date() } = params;
  const dayStart = startOfDay(now).getTime();
  const weekStart = startOfWeek(now).getTime();
  return defs.map((def) => {
    const progress = measure(def, docs, memberId, def.period === "daily" ? dayStart : weekStart, bonusPercent);
    return {
      ...def,
      progress: Math.min(progress, def.target),
      complete: progress >= def.target,
      claimed: claimedKeys.has(def.key),
    };
  });
}

export async function fetchMyClaims(memberId: string, limit = 200): Promise<ObjectiveClaimRow[]> {
  const { data, error } = await supabase
    .from("objective_claims")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Records the claim first: the unique index on (member_id, objective_key) is
 * what stops a double-click - or two tabs - from paying the same objective
 * twice, so the money only moves once the insert has actually landed.
 */
export async function claimObjective(params: {
  memberId: string;
  companyId: string;
  objective: ObjectiveDef;
  /** Goal-Getter / Archivist perks, as a percentage on top. */
  rewardBonusPercent?: number;
}): Promise<ObjectiveClaimRow> {
  const { memberId, companyId, objective, rewardBonusPercent = 0 } = params;
  const multiplier = 1 + rewardBonusPercent / 100;
  const rewardMoney = Math.round(objective.rewardMoney * multiplier);
  const rewardXp = Math.round(objective.rewardXp * multiplier);
  const { data, error } = await supabase
    .from("objective_claims")
    .insert({
      member_id: memberId,
      company_id: companyId,
      objective_key: objective.key,
      period: objective.period,
      reward_money: rewardMoney,
      reward_xp: rewardXp,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("You've already claimed that objective.");
    throw error;
  }
  if (rewardMoney > 0) await awardMoney(memberId, rewardMoney);
  if (rewardXp > 0) await awardXp(memberId, rewardXp);
  return data;
}
