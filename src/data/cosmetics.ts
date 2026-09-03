/**
 * The Cosmetics Shop catalog: one-time Money purchases that change how your
 * desk looks and nothing else. Deliberately zero gameplay effect - the
 * Office Shop (src/data/equipment.ts) is where money buys payout bonuses,
 * and keeping the two apart means neither has to be balanced against the
 * other.
 */
export type CosmeticSlot = "desk" | "chair" | "monitor" | "mug" | "plant" | "poster" | "rug" | "lamp" | "pet";

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  /** Rendered into the scene for every slot except desk/rug, which are drawn
   * as shapes tinted with `color`. */
  emoji: string;
  color?: string;
  cost: number;
  blurb: string;
}

export const SLOT_META: { id: CosmeticSlot; label: string; emoji: string }[] = [
  { id: "desk", label: "Desk", emoji: "🪵" },
  { id: "chair", label: "Chair", emoji: "💺" },
  { id: "monitor", label: "Monitor", emoji: "🖥" },
  { id: "mug", label: "Desk mug", emoji: "☕" },
  { id: "lamp", label: "Lamp", emoji: "💡" },
  { id: "plant", label: "Plant", emoji: "🪴" },
  { id: "poster", label: "Wall art", emoji: "🖼" },
  { id: "rug", label: "Rug", emoji: "🟫" },
  { id: "pet", label: "Office pet", emoji: "🐈" },
];

export const COSMETICS: CosmeticItem[] = [
  // Desks (drawn as a tinted shape)
  { id: "desk-particle", slot: "desk", name: "Particle Board Desk", emoji: "🪵", color: "#b8a086", cost: 0, blurb: "It came with the job." },
  { id: "desk-oak", slot: "desk", name: "Solid Oak Desk", emoji: "🪵", color: "#a3712f", cost: 120, blurb: "Heavy enough to feel permanent." },
  { id: "desk-glass", slot: "desk", name: "Glass Desk", emoji: "🪵", color: "#93c5cf", cost: 220, blurb: "Shows every fingerprint. Worth it." },
  { id: "desk-mahogany", slot: "desk", name: "Executive Mahogany", emoji: "🪵", color: "#7b3f2e", cost: 500, blurb: "The desk of somebody who signs things." },

  // Chairs
  { id: "chair-stool", slot: "chair", name: "Folding Stool", emoji: "🪑", cost: 0, blurb: "Technically seating." },
  { id: "chair-office", slot: "chair", name: "Swivel Chair", emoji: "💺", cost: 90, blurb: "Spins. That's the feature." },
  { id: "chair-throne", slot: "chair", name: "Corner-Office Throne", emoji: "🛋", cost: 400, blurb: "Lumbar support fit for a VP." },

  // Monitors
  { id: "monitor-crt", slot: "monitor", name: "Beige CRT", emoji: "📺", cost: 0, blurb: "Warms the room in winter." },
  { id: "monitor-flat", slot: "monitor", name: "Flat Panel", emoji: "🖥", cost: 110, blurb: "Twelve spreadsheets, side by side." },
  { id: "monitor-laptop", slot: "monitor", name: "Docked Laptop", emoji: "💻", cost: 160, blurb: "Work from anywhere. Mostly here." },

  // Mugs
  { id: "mug-plain", slot: "mug", name: "Break Room Mug", emoji: "☕", cost: 0, blurb: "Chipped, but yours." },
  { id: "mug-boss", slot: "mug", name: '"World’s Okayest Boss"', emoji: "🍵", cost: 40, blurb: "A gift. Probably." },
  { id: "mug-energy", slot: "mug", name: "Energy Drink", emoji: "🥤", cost: 60, blurb: "For deadlines that moved." },
  { id: "mug-thermos", slot: "mug", name: "Steel Thermos", emoji: "🧉", cost: 130, blurb: "Keeps coffee hot until Tuesday." },

  // Lamps
  { id: "lamp-none", slot: "lamp", name: "Overhead Fluorescents", emoji: "", cost: 0, blurb: "The default hum." },
  { id: "lamp-desk", slot: "lamp", name: "Desk Lamp", emoji: "💡", cost: 70, blurb: "A pool of light that is yours alone." },
  { id: "lamp-neon", slot: "lamp", name: "Neon Sign", emoji: "🪩", cost: 260, blurb: "HR has asked about this." },

  // Plants
  { id: "plant-none", slot: "plant", name: "No Plant", emoji: "", cost: 0, blurb: "Nothing to forget to water." },
  { id: "plant-succulent", slot: "plant", name: "Succulent", emoji: "🌵", cost: 50, blurb: "Survives you." },
  { id: "plant-fern", slot: "plant", name: "Potted Fern", emoji: "🪴", cost: 90, blurb: "Needs attention. Gets none." },
  { id: "plant-tree", slot: "plant", name: "Fiddle-Leaf Fig", emoji: "🌳", cost: 240, blurb: "A statement about air quality." },

  // Wall art
  { id: "poster-none", slot: "poster", name: "Bare Wall", emoji: "", cost: 0, blurb: "Minimalism, or forgetfulness." },
  { id: "poster-motivational", slot: "poster", name: '"TEAMWORK" Poster', emoji: "🖼", cost: 45, blurb: "Kittens. A rope. A message." },
  { id: "poster-clock", slot: "poster", name: "Wall Clock", emoji: "🕰", cost: 80, blurb: "Watched, constantly." },
  { id: "poster-diploma", slot: "poster", name: "Framed Diploma", emoji: "📜", cost: 190, blurb: "Hung at exactly eye height." },
  { id: "poster-window", slot: "poster", name: "Actual Window", emoji: "🪟", cost: 450, blurb: "Natural light. You've made it." },

  // Rugs (drawn as a tinted shape)
  { id: "rug-none", slot: "rug", name: "Bare Floor", emoji: "", cost: 0, blurb: "Easy to sweep." },
  { id: "rug-grey", slot: "rug", name: "Grey Office Rug", emoji: "🟫", color: "#a8a29e", cost: 65, blurb: "Institutional, in a calming way." },
  { id: "rug-persian", slot: "rug", name: "Persian Rug", emoji: "🟫", color: "#9f3f3f", cost: 300, blurb: "Absolutely not standard issue." },

  // Pets
  { id: "pet-none", slot: "pet", name: "No Pet", emoji: "", cost: 0, blurb: "Company policy, mostly." },
  { id: "pet-fish", slot: "pet", name: "Desk Fish", emoji: "🐠", cost: 75, blurb: "Low maintenance colleague." },
  { id: "pet-cat", slot: "pet", name: "Office Cat", emoji: "🐈", cost: 280, blurb: "Sleeps on the keyboard. Nobody minds." },
  { id: "pet-dog", slot: "pet", name: "Office Dog", emoji: "🐕", cost: 320, blurb: "Attends every meeting. Contributes." },
  { id: "pet-duck", slot: "pet", name: "Rubber Duck", emoji: "🦆", cost: 25, blurb: "You explain the problem. It solves it." },
];

export const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c] as const));

/** Everything you start with, so a brand-new desk is a complete scene rather
 * than an empty room. */
export const FREE_COSMETIC_IDS = COSMETICS.filter((c) => c.cost === 0).map((c) => c.id);

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = {
  desk: "desk-particle",
  chair: "chair-stool",
  monitor: "monitor-crt",
  mug: "mug-plain",
  lamp: "lamp-none",
  plant: "plant-none",
  poster: "poster-none",
  rug: "rug-none",
  pet: "pet-none",
};

export const WALL_STYLES: { id: string; label: string; color: string }[] = [
  { id: "sand", label: "Sand", color: "#efe9e0" },
  { id: "sage", label: "Sage", color: "#dfe7dd" },
  { id: "sky", label: "Sky", color: "#dee8f2" },
  { id: "blush", label: "Blush", color: "#f2e2e2" },
  { id: "slate", label: "Slate", color: "#d9d9d6" },
  { id: "charcoal", label: "Charcoal", color: "#4b4846" },
];

export const FLOOR_STYLES: { id: string; label: string; color: string }[] = [
  { id: "oak", label: "Oak", color: "#c9a271" },
  { id: "walnut", label: "Walnut", color: "#8a6242" },
  { id: "concrete", label: "Concrete", color: "#b6b3ae" },
  { id: "carpet", label: "Blue Carpet", color: "#7f93a8" },
  { id: "checker", label: "Checkerboard", color: "#e7e5e4" },
];

export function wallColor(id: string): string {
  return WALL_STYLES.find((w) => w.id === id)?.color ?? WALL_STYLES[0].color;
}

export function floorColor(id: string): string {
  return FLOOR_STYLES.find((f) => f.id === id)?.color ?? FLOOR_STYLES[0].color;
}
