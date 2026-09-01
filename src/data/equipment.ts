export interface EquipmentItem {
  key: string;
  name: string;
  emoji: string;
  cost: number;
  payoutBonusPercent: number;
  description: string;
}

/** A small fixed catalog of one-time company purchases - each grants a
 * permanent percentage bonus applied to every task payout company-wide,
 * stacking with every other item owned. */
export const EQUIPMENT_CATALOG: EquipmentItem[] = [
  {
    key: "coffee-machine",
    name: "Espresso Machine",
    emoji: "☕",
    cost: 100,
    payoutBonusPercent: 2,
    description: "A caffeinated office is a productive office.",
  },
  {
    key: "ergonomic-chairs",
    name: "Ergonomic Chairs",
    emoji: "💺",
    cost: 180,
    payoutBonusPercent: 3,
    description: "Fewer backaches, more focus.",
  },
  {
    key: "standing-desks",
    name: "Standing Desks",
    emoji: "🪑",
    cost: 150,
    payoutBonusPercent: 3,
    description: "Comfier employees do slightly better work.",
  },
  {
    key: "fast-printers",
    name: "Fast Printers",
    emoji: "🖨️",
    cost: 200,
    payoutBonusPercent: 4,
    description: "Less time waiting on paperwork.",
  },
  {
    key: "dual-monitors",
    name: "Dual Monitors",
    emoji: "🖥️",
    cost: 250,
    payoutBonusPercent: 5,
    description: "Multitasking, but make it ergonomic.",
  },
  {
    key: "server-upgrade",
    name: "Server Upgrade",
    emoji: "🖧",
    cost: 300,
    payoutBonusPercent: 6,
    description: "Nothing crashes mid-task anymore.",
  },
];

export function getEquipmentItem(key: string): EquipmentItem | undefined {
  return EQUIPMENT_CATALOG.find((e) => e.key === key);
}

export function totalPayoutBonusPercent(ownedKeys: string[]): number {
  return ownedKeys.reduce((sum, k) => sum + (getEquipmentItem(k)?.payoutBonusPercent ?? 0), 0);
}
