import { useCallback, useState } from "react";
import { loadActiveRequests, saveActiveRequests } from "../lib/clientRequests";
import type { ClientRequest } from "../types/template";

export function useClientRequests() {
  const [requests, setRequests] = useState<Record<string, ClientRequest>>(() =>
    loadActiveRequests(),
  );

  const setRequest = useCallback((clientId: string, request: ClientRequest) => {
    setRequests((prev) => {
      const next = { ...prev, [clientId]: request };
      saveActiveRequests(next);
      return next;
    });
  }, []);

  const clearRequest = useCallback((clientId: string) => {
    setRequests((prev) => {
      const next = { ...prev };
      delete next[clientId];
      saveActiveRequests(next);
      return next;
    });
  }, []);

  return { requests, setRequest, clearRequest };
}
