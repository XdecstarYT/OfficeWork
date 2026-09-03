import { supabase } from "./supabaseClient";
import { ENDGAME_GOALS, type EndgameContext, type EndgameGoal } from "../data/endgame";
import type { Database } from "../types/database";

export type RetirementRow = Database["public"]["Tables"]["retirements"]["Row"];

export interface GoalStatus {
  goal: EndgameGoal;
  value: number;
  done: boolean;
  percent: number;
}

export interface CompletionSummary {
  goals: GoalStatus[];
  done: number;
  total: number;
  percent: number;
  /** Highest chapter whose goals are all complete (0 = none yet). */
  chaptersCleared: number;
  /** The chapter the player is currently working through. */
  currentChapter: number;
}

export function evaluateCompletion(ctx: EndgameContext): CompletionSummary {
  const goals: GoalStatus[] = ENDGAME_GOALS.map((goal) => {
    const value = goal.progress(ctx);
    return {
      goal,
      value,
      done: value >= goal.target,
      percent: Math.min(100, Math.round((value / goal.target) * 100)),
    };
  });

  const chapters = [...new Set(ENDGAME_GOALS.map((g) => g.chapter))].sort((a, b) => a - b);
  let chaptersCleared = 0;
  for (const n of chapters) {
    if (goals.filter((g) => g.goal.chapter === n).every((g) => g.done)) chaptersCleared = n;
    else break;
  }

  const done = goals.filter((g) => g.done).length;
  return {
    goals,
    done,
    total: goals.length,
    percent: Math.round((done / goals.length) * 100),
    chaptersCleared,
    currentChapter: Math.min(chapters.length, chaptersCleared + 1),
  };
}

/**
 * The final score. Weighted so that no single system can carry a career on
 * its own - the ranks at the top need breadth, which is the point of the
 * goal ladder.
 */
export function finalScore(ctx: EndgameContext, percent: number): number {
  return Math.round(
    ctx.completedByMe * 10 +
      ctx.careerLevel * 40 +
      ctx.earned * 0.15 +
      ctx.objectivesClaimed * 15 +
      ctx.perkIds.length * 60 +
      ctx.cosmeticIds.length * 20 +
      ctx.projectsDelivered * 120 +
      ctx.loansRepaid * 80 -
      ctx.loansDefaulted * 150 +
      ctx.creditScore * 3 +
      ctx.companyBadges * 100 +
      ctx.treasuryContributed * 0.1 +
      percent * 25,
  );
}

const TITLES: { min: number; title: string; blurb: string }[] = [
  { min: 12000, title: "Chairman Emeritus", blurb: "They named the building after you." },
  { min: 8000, title: "Managing Partner", blurb: "A career other people's careers are measured against." },
  { min: 5000, title: "Vice President", blurb: "You left the place better organised than you found it." },
  { min: 3000, title: "Department Head", blurb: "A whole floor learned to file the way you file." },
  { min: 1800, title: "Senior Associate", blurb: "Reliable, thorough, and quietly missed." },
  { min: 900, title: "Associate", blurb: "You got the hang of it, then got out." },
  { min: 300, title: "Junior Clerk", blurb: "A short career, but the paperwork was tidy." },
  { min: 0, title: "Temp", blurb: "Barely long enough to learn where the coffee is." },
];

export function titleForScore(score: number): { title: string; blurb: string } {
  return TITLES.find((t) => score >= t.min) ?? TITLES[TITLES.length - 1];
}

/** Careers can end early; the ladder is long, and a finished chapter 3 is a
 * real career. Anything before that is a resignation, not a retirement. */
export const RETIREMENT_MIN_CHAPTER = 3;

export function canRetire(summary: CompletionSummary): boolean {
  return summary.chaptersCleared >= RETIREMENT_MIN_CHAPTER;
}

export async function fetchHallOfFame(companyId: string): Promise<RetirementRow[]> {
  const { data, error } = await supabase
    .from("retirements")
    .select("*")
    .eq("company_id", companyId)
    .order("score", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyRetirements(memberId: string): Promise<RetirementRow[]> {
  const { data, error } = await supabase
    .from("retirements")
    .select("*")
    .eq("member_id", memberId)
    .order("retired_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Ends a career: writes the permanent record first, then resets the profile
 * so a new one can start. In that order, a failure part-way leaves a player
 * with their career intact rather than wiped and unrecorded.
 */
export async function retire(params: {
  memberId: string;
  companyId: string;
  displayName: string;
  companyName: string;
  ctx: EndgameContext;
  summary: CompletionSummary;
}): Promise<RetirementRow> {
  const { memberId, companyId, displayName, companyName, ctx, summary } = params;
  const score = finalScore(ctx, summary.percent);
  const { title } = titleForScore(score);

  const { data, error } = await supabase
    .from("retirements")
    .insert({
      member_id: memberId,
      company_id: companyId,
      display_name: displayName,
      company_name: companyName,
      final_title: title,
      score,
      completion_percent: summary.percent,
      stats: {
        documents: ctx.completedByMe,
        earned: Math.round(ctx.earned),
        careerLevel: ctx.careerLevel,
        objectives: ctx.objectivesClaimed,
        perks: ctx.perkIds.length,
        cosmetics: ctx.cosmeticIds.length,
        projects: ctx.projectsDelivered,
        loansRepaid: ctx.loansRepaid,
        creditScore: ctx.creditScore,
        goalsCompleted: summary.done,
        goalsTotal: summary.total,
      } as unknown as Database["public"]["Tables"]["retirements"]["Row"]["stats"],
    })
    .select()
    .single();
  if (error) throw error;

  // Start again: a fresh profile, out of the company, with the record kept.
  const { error: resetError } = await supabase
    .from("profiles")
    .update({
      company_id: null,
      job_title: "Employee",
      level: 1,
      money: 0,
      xp: 0,
      department: null,
      claimed_milestones: [],
      streak_count: 0,
    })
    .eq("id", memberId);
  if (resetError) throw resetError;

  return data;
}
