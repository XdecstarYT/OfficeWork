export interface EmployeeEvent {
  id: string;
  emoji: string;
  headline: string;
  body: string;
  money: number;
  xp: number;
}

/** Flavor events that hit a single random team member instead of the whole
 * company - deliberately mixed positive/negative/neutral, like
 * corporateEvents.ts, so repeatedly rolling isn't a reliable way to farm
 * Money for a favored employee. */
export const EMPLOYEE_EVENTS: EmployeeEvent[] = [
  {
    id: "client-shoutout",
    emoji: "⭐",
    headline: "A Client Gave You a Shoutout",
    body: "A client specifically praised your work in a follow-up email. Leadership noticed and cut you a small bonus.",
    money: 25,
    xp: 5,
  },
  {
    id: "spilled-coffee",
    emoji: "☕",
    headline: "You Spilled Coffee on Your Desk",
    body: "A whole mug, right across your keyboard. You lost some time cleaning up.",
    money: 0,
    xp: -5,
  },
  {
    id: "found-side-gig",
    emoji: "💼",
    headline: "You Picked Up a Quick Side Task",
    body: "Someone from another team asked for a quick favor and paid you out of their own budget for it.",
    money: 20,
    xp: 0,
  },
  {
    id: "car-trouble",
    emoji: "🚗",
    headline: "Car Trouble This Morning",
    body: "You showed up late after your car wouldn't start. It happens - nobody's docking your pay for it, but the day got off to a rocky start.",
    money: 0,
    xp: -3,
  },
  {
    id: "mentor-moment",
    emoji: "🌱",
    headline: "You Mentored a Coworker",
    body: "You took time to help a coworker figure out a tricky task. Good karma, and you picked up a little polish yourself.",
    money: 0,
    xp: 10,
  },
  {
    id: "referral-bonus",
    emoji: "🎁",
    headline: "Referral Bonus Cleared",
    body: "A referral bonus from a while back finally cleared payroll processing.",
    money: 35,
    xp: 0,
  },
  {
    id: "long-meeting",
    emoji: "🥱",
    headline: "A Meeting That Should Have Been an Email",
    body: "An hour of your day vanished into a meeting that could've been three sentences.",
    money: 0,
    xp: -4,
  },
  {
    id: "won-raffle",
    emoji: "🎟️",
    headline: "You Won the Office Raffle",
    body: "Your name got pulled from the office raffle jar. Free money, no strings attached.",
    money: 30,
    xp: 0,
  },
  {
    id: "skill-badge",
    emoji: "🏅",
    headline: "You Picked Up a New Skill",
    body: "You spent some downtime learning something new that'll help with future paperwork.",
    money: 0,
    xp: 12,
  },
  {
    id: "quiet-day",
    emoji: "😌",
    headline: "A Perfectly Ordinary Day",
    body: "Nothing notable happened. Sometimes that's a win in itself.",
    money: 0,
    xp: 0,
  },
];

export function rollEmployeeEvent(): EmployeeEvent {
  return EMPLOYEE_EVENTS[Math.floor(Math.random() * EMPLOYEE_EVENTS.length)];
}
