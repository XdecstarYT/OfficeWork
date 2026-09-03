/**
 * The Corner Office - the goal ladder that gives Office Quest an ending.
 *
 * Every goal reads from data the game already keeps (documents, perks, loans,
 * projects, the desk), so nothing here needs its own counter column and no
 * goal can drift out of step with the tab it describes.
 */
import { COSMETICS, SLOT_META } from "./cosmetics";
import { PERKS } from "./perks";

export interface EndgameContext {
  /** Documents this player completed. */
  completedByMe: number;
  /** Payouts banked from that work. */
  earned: number;
  careerLevel: number;
  money: number;
  objectivesClaimed: number;
  perkIds: string[];
  cosmeticIds: string[];
  /** Distinct desk slots with something bought in them. */
  filledSlots: number;
  loansRepaid: number;
  loansDefaulted: number;
  creditScore: number;
  projectsDelivered: number;
  companyBadges: number;
  treasuryContributed: number;
  stocksOwned: number;
}

export interface EndgameGoal {
  id: string;
  chapter: number;
  emoji: string;
  title: string;
  /** Where to go to work on it. */
  hint: string;
  target: number;
  progress: (ctx: EndgameContext) => number;
  /** Rendered as "3 / 10" unless this formats it (e.g. money). */
  format?: (value: number) => string;
}

export const CHAPTERS: { n: number; name: string; blurb: string }[] = [
  { n: 1, name: "The New Hire", blurb: "Learn where the filing cabinet is." },
  { n: 2, name: "Finding Your Feet", blurb: "Start making the job your own." },
  { n: 3, name: "Making a Name", blurb: "People start routing the hard work to you." },
  { n: 4, name: "The Corner Office", blurb: "The view from the top of the org chart." },
];

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export const ENDGAME_GOALS: EndgameGoal[] = [
  // Chapter 1 - The New Hire
  {
    id: "first-ten",
    chapter: 1,
    emoji: "📄",
    title: "Complete 10 documents",
    hint: "My Work",
    target: 10,
    progress: (c) => c.completedByMe,
  },
  {
    id: "level-3",
    chapter: 1,
    emoji: "⭐",
    title: "Reach career level 3",
    hint: "Earned by completing work",
    target: 3,
    progress: (c) => c.careerLevel,
  },
  {
    id: "claim-5",
    chapter: 1,
    emoji: "🎯",
    title: "Claim 5 objectives",
    hint: "Dashboard",
    target: 5,
    progress: (c) => c.objectivesClaimed,
  },
  {
    id: "earn-500",
    chapter: 1,
    emoji: "💵",
    title: "Bank $500 in payouts",
    hint: "My Work",
    target: 500,
    progress: (c) => c.earned,
    format: money,
  },

  // Chapter 2 - Finding Your Feet
  {
    id: "fifty-docs",
    chapter: 2,
    emoji: "🗂",
    title: "Complete 50 documents",
    hint: "My Work",
    target: 50,
    progress: (c) => c.completedByMe,
  },
  {
    id: "level-6",
    chapter: 2,
    emoji: "🌟",
    title: "Reach career level 6",
    hint: "Earned by completing work",
    target: 6,
    progress: (c) => c.careerLevel,
  },
  {
    id: "three-perks",
    chapter: 2,
    emoji: "🧠",
    title: "Unlock 3 perks",
    hint: "Perks",
    target: 3,
    progress: (c) => c.perkIds.length,
  },
  {
    id: "five-cosmetics",
    chapter: 2,
    emoji: "🛍",
    title: "Buy 5 things for your desk",
    hint: "Your Desk",
    target: 5,
    progress: (c) => c.cosmeticIds.length,
  },
  {
    id: "repay-loan",
    chapter: 2,
    emoji: "🏦",
    title: "Take a loan and pay it off",
    hint: "Bank",
    target: 1,
    progress: (c) => c.loansRepaid,
  },

  // Chapter 3 - Making a Name
  {
    id: "hundred-fifty",
    chapter: 3,
    emoji: "📚",
    title: "Complete 150 documents",
    hint: "My Work",
    target: 150,
    progress: (c) => c.completedByMe,
  },
  {
    id: "level-12",
    chapter: 3,
    emoji: "🏅",
    title: "Reach career level 12",
    hint: "Earned by completing work",
    target: 12,
    progress: (c) => c.careerLevel,
  },
  {
    id: "three-projects",
    chapter: 3,
    emoji: "🚩",
    title: "Contribute to 3 delivered projects",
    hint: "Projects",
    target: 3,
    progress: (c) => c.projectsDelivered,
  },
  {
    id: "furnished",
    chapter: 3,
    emoji: "🪑",
    title: "Furnish every desk slot",
    hint: "Your Desk",
    target: SLOT_META.length,
    progress: (c) => c.filledSlots,
  },
  {
    id: "badges-3",
    chapter: 3,
    emoji: "🏢",
    title: "Work at a company with 3 badges",
    hint: "Company",
    target: 3,
    progress: (c) => c.companyBadges,
  },
  {
    id: "portfolio",
    chapter: 3,
    emoji: "📈",
    title: "Hold shares in 3 companies",
    hint: "Stock Market",
    target: 3,
    progress: (c) => c.stocksOwned,
  },

  // Chapter 4 - The Corner Office
  {
    id: "three-hundred",
    chapter: 4,
    emoji: "🗄",
    title: "Complete 300 documents",
    hint: "My Work",
    target: 300,
    progress: (c) => c.completedByMe,
  },
  {
    id: "level-20",
    chapter: 4,
    emoji: "👑",
    title: "Reach career level 20",
    hint: "Earned by completing work",
    target: 20,
    progress: (c) => c.careerLevel,
  },
  {
    id: "branch-maxed",
    chapter: 4,
    emoji: "🌳",
    title: "Max out a whole perk branch",
    hint: "Perks",
    target: 1,
    progress: (c) => {
      const byBranch = new Map<string, number>();
      for (const id of c.perkIds) {
        const perk = PERKS.find((p) => p.id === id);
        if (perk) byBranch.set(perk.branch, (byBranch.get(perk.branch) ?? 0) + 1);
      }
      const perBranch = new Map<string, number>();
      for (const p of PERKS) perBranch.set(p.branch, (perBranch.get(p.branch) ?? 0) + 1);
      return [...byBranch.entries()].some(([b, n]) => n >= (perBranch.get(b) ?? Infinity)) ? 1 : 0;
    },
  },
  {
    id: "triple-a",
    chapter: 4,
    emoji: "💎",
    title: "Reach a AAA credit rating",
    hint: "Bank",
    target: 90,
    progress: (c) => c.creditScore,
  },
  {
    id: "treasury",
    chapter: 4,
    emoji: "🏛",
    title: "Put $2,000 into the treasury",
    hint: "Bank",
    target: 2000,
    progress: (c) => c.treasuryContributed,
    format: money,
  },
  {
    id: "ten-projects",
    chapter: 4,
    emoji: "🏆",
    title: "Contribute to 10 delivered projects",
    hint: "Projects",
    target: 10,
    progress: (c) => c.projectsDelivered,
  },
];

export const TOTAL_COSMETICS = COSMETICS.filter((c) => c.cost > 0).length;
