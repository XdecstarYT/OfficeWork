const PLAYER_STATE_KEY = "officequest.player";

export interface PlayerState {
  money: number;
}

const DEFAULT_STATE: PlayerState = {
  money: 0,
};

export function loadPlayerState(): PlayerState {
  try {
    const raw = localStorage.getItem(PLAYER_STATE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<PlayerState>) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function savePlayerState(state: PlayerState) {
  try {
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}
