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

export function clearRecentIds() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore storage failures
  }
}

const FAVORITE_CLIENTS_KEY = "officequest.favoriteClients";

export function loadFavoriteClients(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITE_CLIENTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveFavoriteClients(favorites: Set<string>) {
  try {
    localStorage.setItem(FAVORITE_CLIENTS_KEY, JSON.stringify([...favorites]));
  } catch {
    // ignore storage failures (private browsing, quota, etc.)
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

const CLIENT_EARNINGS_KEY = "officequest.clientEarnings";

export function loadClientEarnings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CLIENT_EARNINGS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveClientEarnings(earnings: Record<string, number>) {
  try {
    localStorage.setItem(CLIENT_EARNINGS_KEY, JSON.stringify(earnings));
  } catch {
    // ignore storage failures
  }
}

export type FontSize = "compact" | "normal" | "large";
const FONT_SIZE_KEY = "officequest.fontSize";

export function loadFontSize(): FontSize {
  try {
    const raw = localStorage.getItem(FONT_SIZE_KEY);
    return raw === "compact" || raw === "large" ? raw : "normal";
  } catch {
    return "normal";
  }
}

export function saveFontSize(size: FontSize) {
  try {
    localStorage.setItem(FONT_SIZE_KEY, size);
  } catch {
    // ignore storage failures
  }
}

const SOUND_ENABLED_KEY = "officequest.soundEnabled";

export function loadSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

const STARRED_DOCUMENTS_KEY = "officequest.starredDocuments";

export function loadStarredDocuments(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_DOCUMENTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveStarredDocuments(starred: Set<string>) {
  try {
    localStorage.setItem(STARRED_DOCUMENTS_KEY, JSON.stringify([...starred]));
  } catch {
    // ignore storage failures
  }
}

export function loadDraftFieldValues(documentId: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(`officequest.draft.${documentId}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

export function saveDraftFieldValues(documentId: string, values: Record<string, string>) {
  try {
    localStorage.setItem(`officequest.draft.${documentId}`, JSON.stringify(values));
  } catch {
    // ignore storage failures
  }
}

export function clearDraftFieldValues(documentId: string) {
  try {
    localStorage.removeItem(`officequest.draft.${documentId}`);
  } catch {
    // ignore storage failures
  }
}

export type ContrastMode = "normal" | "high";
const CONTRAST_KEY = "officequest.contrast";

export function loadContrastMode(): ContrastMode {
  try {
    return localStorage.getItem(CONTRAST_KEY) === "high" ? "high" : "normal";
  } catch {
    return "normal";
  }
}

export function saveContrastMode(mode: ContrastMode) {
  try {
    localStorage.setItem(CONTRAST_KEY, mode);
  } catch {
    // ignore storage failures
  }
}

const COMPACT_NAV_KEY = "officequest.compactNav";

export function loadCompactNav(): boolean {
  try {
    return localStorage.getItem(COMPACT_NAV_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCompactNav(enabled: boolean) {
  try {
    localStorage.setItem(COMPACT_NAV_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

const DISMISSED_CHANGELOG_KEY = "officequest.dismissedChangelogVersion";

export function loadDismissedChangelogVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_CHANGELOG_KEY);
  } catch {
    return null;
  }
}

export function saveDismissedChangelogVersion(version: string) {
  try {
    localStorage.setItem(DISMISSED_CHANGELOG_KEY, version);
  } catch {
    // ignore storage failures
  }
}

const PLAYTIME_KEY_PREFIX = "officequest.playtimeMinutes.";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadPlaytimeToday(): number {
  try {
    const raw = localStorage.getItem(PLAYTIME_KEY_PREFIX + todayKey());
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addPlaytimeMinute() {
  try {
    const key = PLAYTIME_KEY_PREFIX + todayKey();
    const current = Number(localStorage.getItem(key)) || 0;
    localStorage.setItem(key, String(current + 1));
  } catch {
    // ignore storage failures
  }
}

/** Wipes every local (per-browser) preference this app has ever written -
 * favorites, recents, font size, sound toggle, drafts, etc. Server-stored
 * data (money, documents, company state) is untouched. */
export function resetLocalPreferences() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("officequest.")) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage failures
  }
}
