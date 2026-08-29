import type { ClientRequest } from "../types/template";

const KEY = "officequest.clientRequests";

export function loadActiveRequests(): Record<string, ClientRequest> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, ClientRequest>) : {};
  } catch {
    return {};
  }
}

export function saveActiveRequests(requests: Record<string, ClientRequest>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(requests));
  } catch {
    // ignore storage failures
  }
}
