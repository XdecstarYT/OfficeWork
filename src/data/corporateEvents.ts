export interface CorporateEvent {
  id: string;
  emoji: string;
  headline: string;
  body: string;
  /** Applied to every current member (including the Owner). Can be negative. */
  moneyPerMember: number;
  xpPerMember: number;
}

/** A curated pool of flavor events an Owner can "roll" for - deliberately a
 * mix of positive/negative/neutral so repeatedly rolling isn't a reliable
 * way to farm Money. */
export const CORPORATE_EVENTS: CorporateEvent[] = [
  {
    id: "quarterly-bonus",
    emoji: "🎉",
    headline: "Quarterly Bonus Announced!",
    body: "Leadership is pleased to announce the company beat its targets this quarter. Everyone receives a bonus.",
    moneyPerMember: 40,
    xpPerMember: 0,
  },
  {
    id: "budget-cuts",
    emoji: "📉",
    headline: "Budget Cuts This Quarter",
    body: "Revenue came in under projections. Leadership has asked everyone to tighten their belts - a small deduction has been applied company-wide.",
    moneyPerMember: -20,
    xpPerMember: 0,
  },
  {
    id: "office-party",
    emoji: "🎊",
    headline: "Office Party!",
    body: "Someone brought in a cake for no particular reason. Morale is up. Everyone gets a small treat allowance.",
    moneyPerMember: 15,
    xpPerMember: 5,
  },
  {
    id: "printer-broke",
    emoji: "🖨️",
    headline: "The Printer Broke Again",
    body: "The office printer jammed spectacularly and took the afternoon with it. Productivity took a small hit.",
    moneyPerMember: 0,
    xpPerMember: -3,
  },
  {
    id: "surprise-audit",
    emoji: "🔍",
    headline: "Surprise Audit",
    body: "An external audit turned up a few minor paperwork issues. Nothing serious, but it cost the company a bit in consulting fees.",
    moneyPerMember: -15,
    xpPerMember: 0,
  },
  {
    id: "client-referral",
    emoji: "🤝",
    headline: "New Client Referral",
    body: "A happy client referred a friend's business your way. A referral bonus has been distributed to the team.",
    moneyPerMember: 30,
    xpPerMember: 5,
  },
  {
    id: "training-day",
    emoji: "📚",
    headline: "Professional Development Day",
    body: "The whole team spent the day in training. It cost a bit, but everyone came out sharper for it.",
    moneyPerMember: -10,
    xpPerMember: 15,
  },
  {
    id: "server-outage",
    emoji: "🔌",
    headline: "Server Outage",
    body: "The office network went down for a few hours. A frustrating day, but everyone made do.",
    moneyPerMember: -5,
    xpPerMember: -5,
  },
  {
    id: "industry-award",
    emoji: "🏆",
    headline: "Industry Award Win",
    body: "The company was recognized with a regional industry award. Great publicity, and a nice bonus for the team that made it happen.",
    moneyPerMember: 50,
    xpPerMember: 10,
  },
  {
    id: "quiet-week",
    emoji: "😌",
    headline: "A Quiet Week",
    body: "Nothing much happened this week. Sometimes that's exactly what an office needs.",
    moneyPerMember: 0,
    xpPerMember: 0,
  },
];

export function rollCorporateEvent(): CorporateEvent {
  return CORPORATE_EVENTS[Math.floor(Math.random() * CORPORATE_EVENTS.length)];
}
