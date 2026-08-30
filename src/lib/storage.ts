import type { DocumentTemplate } from "../types/template";

const FAVORITES_KEY = "officequest.favorites";
const RECENT_KEY = "officequest.recent";
const RECENT_LIMIT = 12;
const CUSTOM_TEMPLATES_KEY = "officequest.customTemplates";

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

export function loadCustomTemplates(): DocumentTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as DocumentTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: DocumentTemplate[]) {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // ignore storage failures
  }
}
