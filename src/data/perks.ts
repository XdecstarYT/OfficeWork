/**
 * The perk tree. Perk points come from career levels (one per level past the
 * first), so perks are a long-run spend of the same XP that already drives
 * levelling rather than a new currency to grind.
 *
 * Every effect here is applied at exactly one place in the app - see the
 * `wired at` note on each field - so a perk can't quietly do nothing.
 */
export interface PerkEffects {
  /** Added to the company equipment bonus. Wired at: WorkPage payouts. */
  payoutBonusPercent?: number;
  /** Wired at: WorkPage XP awards. */
  xpBonusPercent?: number;
  /** Wired at: objectives claim. */
  objectiveRewardPercent?: number;
  /** Wired at: bank loan offers + takeLoan. */
  loanRateDiscountPercent?: number;
  /** Wired at: credit rating. */
  creditScoreBonus?: number;
  /** Wired at: treasury cut on completed work. */
  treasuryCutDiscountPercent?: number;
}

export type PerkBranch = "earnings" | "finance" | "craft";

export interface Perk {
  id: string;
  branch: PerkBranch;
  tier: number;
  name: string;
  emoji: string;
  description: string;
  /** Perk points it costs to take. */
  cost: number;
  /** Career level you must have reached. */
  minLevel: number;
  /** Perk that has to be taken first. */
  requires: string | null;
  effects: PerkEffects;
}

export const PERK_BRANCHES: { id: PerkBranch; name: string; emoji: string; blurb: string }[] = [
  { id: "earnings", name: "Rainmaking", emoji: "💰", blurb: "Get paid more for the same paperwork." },
  { id: "finance", name: "Treasury", emoji: "🏦", blurb: "Cheaper credit and a lighter company cut." },
  { id: "craft", name: "Craft", emoji: "✍️", blurb: "Faster progression and richer objectives." },
];

export const PERKS: Perk[] = [
  // Rainmaking
  {
    id: "hard-bargainer",
    branch: "earnings",
    tier: 1,
    name: "Hard Bargainer",
    emoji: "🤝",
    description: "+4% on every task payout.",
    cost: 1,
    minLevel: 2,
    requires: null,
    effects: { payoutBonusPercent: 4 },
  },
  {
    id: "rainmaker",
    branch: "earnings",
    tier: 2,
    name: "Rainmaker",
    emoji: "🌧",
    description: "+8% more on top of Hard Bargainer.",
    cost: 2,
    minLevel: 4,
    requires: "hard-bargainer",
    effects: { payoutBonusPercent: 8 },
  },
  {
    id: "tycoon",
    branch: "earnings",
    tier: 3,
    name: "Tycoon",
    emoji: "🎩",
    description: "+15% more again. Paperwork has never paid better.",
    cost: 3,
    minLevel: 8,
    requires: "rainmaker",
    effects: { payoutBonusPercent: 15 },
  },

  // Treasury
  {
    id: "frugal",
    branch: "finance",
    tier: 1,
    name: "Frugal",
    emoji: "🪙",
    description: "Bank loans cost 25% less interest per day.",
    cost: 1,
    minLevel: 2,
    requires: null,
    effects: { loanRateDiscountPercent: 25 },
  },
  {
    id: "good-standing",
    branch: "finance",
    tier: 2,
    name: "Good Standing",
    emoji: "📈",
    description: "+12 to your credit score, unlocking bigger desks sooner.",
    cost: 2,
    minLevel: 5,
    requires: "frugal",
    effects: { creditScoreBonus: 12 },
  },
  {
    id: "tax-shelter",
    branch: "finance",
    tier: 3,
    name: "Tax Shelter",
    emoji: "🏝",
    description: "Half the company treasury cut comes out of your payouts.",
    cost: 3,
    minLevel: 7,
    requires: "good-standing",
    effects: { treasuryCutDiscountPercent: 50 },
  },

  // Craft
  {
    id: "fast-filer",
    branch: "craft",
    tier: 1,
    name: "Fast Filer",
    emoji: "⚡",
    description: "+20% XP from completed work.",
    cost: 1,
    minLevel: 2,
    requires: null,
    effects: { xpBonusPercent: 20 },
  },
  {
    id: "goal-getter",
    branch: "craft",
    tier: 2,
    name: "Goal-Getter",
    emoji: "🎯",
    description: "+30% money and XP from claimed objectives.",
    cost: 2,
    minLevel: 4,
    requires: "fast-filer",
    effects: { objectiveRewardPercent: 30 },
  },
  {
    id: "archivist",
    branch: "craft",
    tier: 3,
    name: "Archivist",
    emoji: "📚",
    description: "+40% XP again, and another +30% on objectives.",
    cost: 3,
    minLevel: 9,
    requires: "goal-getter",
    effects: { xpBonusPercent: 40, objectiveRewardPercent: 30 },
  },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p] as const));

/** Perk points a career level is worth in total (one per level past the first). */
export function perkPointsForLevel(careerLevel: number): number {
  return Math.max(0, careerLevel - 1);
}

/** Sums every effect across the perks a player owns. */
export function combineEffects(perkIds: Iterable<string>): Required<PerkEffects> {
  const total: Required<PerkEffects> = {
    payoutBonusPercent: 0,
    xpBonusPercent: 0,
    objectiveRewardPercent: 0,
    loanRateDiscountPercent: 0,
    creditScoreBonus: 0,
    treasuryCutDiscountPercent: 0,
  };
  for (const id of perkIds) {
    const perk = PERK_BY_ID.get(id);
    if (!perk) continue;
    for (const [key, value] of Object.entries(perk.effects)) {
      total[key as keyof PerkEffects] += value as number;
    }
  }
  // Discounts are shares of a whole, so cap them rather than letting three
  // sources add up past 100% and start paying people to borrow.
  total.loanRateDiscountPercent = Math.min(90, total.loanRateDiscountPercent);
  total.treasuryCutDiscountPercent = Math.min(100, total.treasuryCutDiscountPercent);
  return total;
}
