export interface ClientPersona {
  id: string;
  name: string;
  company: string;
  avatar: string;
  personality: string;
  categoryAffinity: string[];
  payoutRange: [number, number];
}

export const CLIENTS: ClientPersona[] = [
  {
    id: "priya-northwind",
    name: "Priya Natarajan",
    company: "Northwind Logistics",
    avatar: "📦",
    personality: "Brisk operations director who wants things buttoned up fast — no small talk, all business.",
    categoryAffinity: ["procurement-vendor", "admin-office-ops", "finance-accounting"],
    payoutRange: [15, 45],
  },
  {
    id: "marcus-brightline",
    name: "Marcus Webb",
    company: "Brightline Media",
    avatar: "🎬",
    personality: "Enthusiastic marketing director, always pitching the next big campaign, generous with compliments.",
    categoryAffinity: ["sales-marketing", "correspondence"],
    payoutRange: [20, 60],
  },
  {
    id: "dana-northstar",
    name: "Dana Kim",
    company: "Northstar Financial",
    avatar: "💼",
    personality: "Meticulous VP of Finance who double-checks everything and appreciates precision over speed.",
    categoryAffinity: ["finance-accounting", "legal-compliance"],
    payoutRange: [25, 70],
  },
  {
    id: "tomas-vertex",
    name: "Tomas Novak",
    company: "Vertex Systems",
    avatar: "🖥️",
    personality: "Deadpan IT manager, communicates in short clipped sentences, secretly loves a well-written runbook.",
    categoryAffinity: ["it-technical"],
    payoutRange: [20, 55],
  },
  {
    id: "grace-harborview",
    name: "Grace Whitfield",
    company: "Harborview HR Partners",
    avatar: "🧑‍💼",
    personality: "Warm, thorough HR consultant who cares a lot about getting the tone of people-facing docs right.",
    categoryAffinity: ["human-resources"],
    payoutRange: [20, 50],
  },
  {
    id: "sofia-clearpath",
    name: "Sofia Reyes",
    company: "Clearpath Consulting",
    avatar: "📊",
    personality: "Fast-talking project manager juggling five things at once, appreciates anyone who keeps up.",
    categoryAffinity: ["project-management"],
    payoutRange: [20, 60],
  },
  {
    id: "kevin-summit",
    name: "Kevin Tran",
    company: "Summit Retail Group",
    avatar: "🛒",
    personality: "Friendly but firm customer experience lead, always thinking about how the customer will feel.",
    categoryAffinity: ["customer-service"],
    payoutRange: [15, 40],
  },
  {
    id: "anika-fieldworks",
    name: "Anika Petrova",
    company: "Fieldworks Supply Co.",
    avatar: "🚚",
    personality: "No-nonsense procurement lead, negotiates everything, respects a firm counter-offer.",
    categoryAffinity: ["procurement-vendor", "finance-accounting"],
    payoutRange: [20, 55],
  },
];

export function getClient(id: string): ClientPersona | undefined {
  return CLIENTS.find((c) => c.id === id);
}
