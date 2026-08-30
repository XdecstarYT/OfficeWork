const XP_PER_LEVEL = 100;

export function careerLevelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export interface CareerProgress {
  level: number;
  intoLevel: number;
  xpPerLevel: number;
}

export function careerProgress(xp: number): CareerProgress {
  const level = careerLevelFromXp(xp);
  const intoLevel = xp - (level - 1) * XP_PER_LEVEL;
  return { level, intoLevel, xpPerLevel: XP_PER_LEVEL };
}
