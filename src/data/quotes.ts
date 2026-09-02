export const DAILY_QUOTES = [
  "Paperwork done is paperwork you never have to think about again.",
  "Every completed form is a small act of order in a chaotic world.",
  "The inbox always refills. Do the next thing anyway.",
  "Progress, not perfection - especially in triplicate.",
  "A tidy queue is a clear mind.",
  "Somebody's got to keep the business running. Might as well be you.",
  "Small tasks, done consistently, build big careers.",
  "The best time to file it was yesterday. The second best time is now.",
  "Nobody remembers the meeting that could've been an email. They remember who got it done.",
  "Today's grunt work is tomorrow's promotion.",
  "You don't need to love the paperwork. You just need to finish it.",
  "Every signature is a promise kept.",
  "Momentum beats motivation - just start the next form.",
  "Good coworkers show up. Great coworkers show up and file on time.",
  "The office runs on people who don't wait to be asked twice.",
];

/** Deterministic pick by day-of-year, so it's the same quote all day for
 * everyone rather than a new random one on every render. */
export function quoteOfTheDay(): string {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}
