export interface CareerMilestone {
  id: string;
  emoji: string;
  label: string;
  description: string;
  rewardMoney: number;
  rewardXp: number;
}

/** An optional progression track (toggled on from Company Settings) mainly meant for solo play - each milestone
 * is derived from stats the game already tracks, so there's nothing extra to maintain besides this list and the
 * player's claimed_milestones array. */
export const CAREER_MILESTONES: CareerMilestone[] = [
  {
    id: "first-task",
    emoji: "✅",
    label: "First Task Complete",
    description: "Complete your first piece of paperwork.",
    rewardMoney: 20,
    rewardXp: 15,
  },
  {
    id: "tasks-10",
    emoji: "📚",
    label: "Getting Into a Rhythm",
    description: "Complete 10 tasks total.",
    rewardMoney: 50,
    rewardXp: 40,
  },
  {
    id: "tasks-25",
    emoji: "🏭",
    label: "Paperwork Machine",
    description: "Complete 25 tasks total.",
    rewardMoney: 120,
    rewardXp: 100,
  },
  {
    id: "money-100",
    emoji: "💵",
    label: "First Hundred",
    description: "Earn $100.",
    rewardMoney: 25,
    rewardXp: 20,
  },
  {
    id: "money-500",
    emoji: "💰",
    label: "Building a Nest Egg",
    description: "Earn $500.",
    rewardMoney: 75,
    rewardXp: 50,
  },
  {
    id: "level-5",
    emoji: "⭐",
    label: "Career Level 5",
    description: "Reach Career Level 5.",
    rewardMoney: 60,
    rewardXp: 0,
  },
  {
    id: "level-10",
    emoji: "🌟",
    label: "Career Level 10",
    description: "Reach Career Level 10.",
    rewardMoney: 150,
    rewardXp: 0,
  },
  {
    id: "hire-coworker",
    emoji: "🤖",
    label: "Not Alone Anymore",
    description: "Hire your first AI coworker.",
    rewardMoney: 30,
    rewardXp: 25,
  },
  {
    id: "day-5",
    emoji: "📅",
    label: "A Full Work Week",
    description: "Reach Day 5.",
    rewardMoney: 80,
    rewardXp: 40,
  },
  {
    id: "first-update",
    emoji: "📰",
    label: "Company Voice",
    description: "Post your first Corporate Update.",
    rewardMoney: 15,
    rewardXp: 10,
  },
];

export interface CareerStats {
  tasksCompleted: number;
  money: number;
  careerLevel: number;
  npcCount: number;
  currentDay: number;
  updatesPosted: number;
}

export function isMilestoneComplete(id: string, stats: CareerStats): boolean {
  switch (id) {
    case "first-task":
      return stats.tasksCompleted >= 1;
    case "tasks-10":
      return stats.tasksCompleted >= 10;
    case "tasks-25":
      return stats.tasksCompleted >= 25;
    case "money-100":
      return stats.money >= 100;
    case "money-500":
      return stats.money >= 500;
    case "level-5":
      return stats.careerLevel >= 5;
    case "level-10":
      return stats.careerLevel >= 10;
    case "hire-coworker":
      return stats.npcCount >= 1;
    case "day-5":
      return stats.currentDay >= 5;
    case "first-update":
      return stats.updatesPosted >= 1;
    default:
      return false;
  }
}
