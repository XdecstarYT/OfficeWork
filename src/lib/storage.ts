const FAVORITES_KEY = "officequest.favorites";
const RECENT_KEY = "officequest.recent";
const RECENT_LIMIT = 12;

export function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
  }
}

export function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentId(id: string) {
  try {
    const current = loadRecentIds().filter((existing) => existing !== id);
    current.unshift(id);
    localStorage.setItem(RECENT_KEY, JSON.stringify(current.slice(0, RECENT_LIMIT)));
  } catch {
    // ignore storage failures
  }
}

const CLIENT_RELATIONSHIPS_KEY = "officequest.clientRelationships";

export function loadClientRelationships(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CLIENT_RELATIONSHIPS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveClientRelationships(relationships: Record<string, number>) {
  try {
    localStorage.setItem(CLIENT_RELATIONSHIPS_KEY, JSON.stringify(relationships));
  } catch {
    // ignore storage failures
  }
}
